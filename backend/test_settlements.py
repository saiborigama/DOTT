import os
import tempfile
import unittest
from datetime import datetime, timedelta, UTC

def utc_now():
    return datetime.now(UTC).replace(tzinfo=None)


class SettlementRulesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        db_path = os.path.join(cls.tmp.name, "settlement_test.db")
        os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"

        import main  # noqa: WPS433 - import after env setup keeps this test isolated
        import database

        cls.main = main
        cls.database = database
        cls.db = database.SessionLocal()
        database.Base.metadata.drop_all(bind=database.engine)
        database.Base.metadata.create_all(bind=database.engine)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        cls.database.engine.dispose()
        cls.tmp.cleanup()

    def setUp(self):
        m = self.main
        for model in [
            m.SettlementPayment,
            m.SettlementInvoice,
            m.ReturnRequest,
            m.OrderItem,
            m.Order,
            m.Product,
            m.Shop,
            m.User,
        ]:
            self.db.query(model).delete()
        self.db.commit()

        self.admin = m.User(
            name="DOTT Admin",
            email="admin-settlement@test.local",
            phone="9000000000",
            password="x",
            role=m.RoleEnum.ADMIN,
            upi_id="dott@upi",
        )
        self.vendor = m.User(
            name="Sai Vendor",
            email="vendor-settlement@test.local",
            phone="9000000001",
            password="x",
            role=m.RoleEnum.OWNER,
        )
        self.rider = m.User(
            name="Ravi Rider",
            email="rider-settlement@test.local",
            phone="9000000002",
            password="x",
            role=m.RoleEnum.RIDER,
        )
        self.customer = m.User(
            name="Test Customer",
            email="customer-settlement@test.local",
            phone="9000000003",
            password="x",
            role=m.RoleEnum.CUSTOMER,
        )
        self.db.add_all([self.admin, self.vendor, self.rider, self.customer])
        self.db.flush()
        self.shop = m.Shop(
            owner_id=self.vendor.id,
            name="SAI HUB",
            category="Fashion",
            address="Bellampally",
            city="Mancherial",
            phone="9000000001",
            lat=19.06,
            lng=79.48,
        )
        self.db.add(self.shop)
        self.db.flush()
        self.product = m.Product(
            shop_id=self.shop.id,
            name="Grey Shirt",
            price=500,
            category="Shirts",
            stock=20,
        )
        self.db.add(self.product)
        self.db.commit()

    def add_order(
        self,
        code,
        *,
        status,
        payment="cod",
        product_value=500,
        delivery_fee=20,
        platform_fee=10,
        gst=0,
        rider_earning=40,
        delivered_at=None,
        refund_status="NOT_APPLICABLE",
        refund_amount=0,
        cod_collected=None,
    ):
        m = self.main
        total = product_value + delivery_fee + platform_fee + gst
        order = m.Order(
            order_code=code,
            customer_id=self.customer.id,
            shop_id=self.shop.id,
            rider_id=self.rider.id,
            delivery_address="Bellampally, Mancherial",
            status=status,
            payment_method=payment,
            subtotal=product_value,
            delivery_fee=delivery_fee,
            platform_fee=platform_fee,
            gst_amount=gst,
            total=total,
            cod_due_amount=total if payment == "cod" else 0,
            cod_collected=(status == m.OrderStatusEnum.DELIVERED and payment == "cod") if cod_collected is None else cod_collected,
            rider_earning=rider_earning,
            delivered_at=delivered_at,
            refund_status=refund_status,
            refund_amount=refund_amount,
            placed_at=(delivered_at or utc_now()) - timedelta(minutes=20),
        )
        self.db.add(order)
        self.db.flush()
        self.db.add(m.OrderItem(order_id=order.id, product_id=self.product.id, name="Grey Shirt", price=product_value, qty=1))
        self.db.commit()
        return order

    def test_settlement_real_world_rules(self):
        m = self.main
        delivered_at = utc_now() - timedelta(hours=3)

        self.add_order(
            "COD500",
            status=m.OrderStatusEnum.DELIVERED,
            payment="cod",
            product_value=500,
            delivery_fee=32,
            rider_earning=50,
            delivered_at=delivered_at,
        )
        self.add_order(
            "PREPAID700",
            status=m.OrderStatusEnum.DELIVERED,
            payment="upi",
            product_value=700,
            delivery_fee=25,
            rider_earning=45,
            delivered_at=delivered_at,
        )
        self.add_order(
            "CANCELLED999",
            status=m.OrderStatusEnum.CANCELLED,
            payment="cod",
            product_value=999,
            delivery_fee=40,
            rider_earning=55,
            delivered_at=delivered_at,
        )
        self.add_order(
            "REFUNDED600",
            status=m.OrderStatusEnum.DELIVERED,
            payment="cod",
            product_value=600,
            delivery_fee=30,
            rider_earning=40,
            delivered_at=delivered_at,
            refund_status="REFUNDED",
            refund_amount=600,
        )

        m.sync_settlement_invoices(self.db)

        vendor_invoice = self.db.query(m.SettlementInvoice).filter_by(entity_type="vendor", shop_id=self.shop.id).one()
        self.assertEqual(vendor_invoice.total_orders, 3)
        self.assertEqual(vendor_invoice.product_value, 1200)
        self.assertEqual(vendor_invoice.net_payable, 1200)
        self.assertEqual(vendor_invoice.pending_amount, 1200)

        rider_invoice = self.db.query(m.SettlementInvoice).filter_by(entity_type="rider", user_id=self.rider.id).one()
        self.assertEqual(rider_invoice.total_orders, 3)
        self.assertEqual(rider_invoice.delivery_collected, 87)
        self.assertEqual(rider_invoice.gross_earnings, 87)
        self.assertEqual(rider_invoice.pending_amount, 87)

        cod_summary = m.rider_cod_settlement_summary(self.db, self.rider)
        self.assertEqual(cod_summary["totalCollected"], 1182)
        self.assertEqual(cod_summary["pendingAmount"], 1182)
        self.assertEqual(cod_summary["companyAccount"]["upiId"], "dott@upi")

        dashboard = m.admin_settlement_dashboard(self.db, delivered_at - timedelta(days=1), delivered_at + timedelta(days=1))
        rider_row = dashboard["riders"][0]
        self.assertEqual(rider_row["pendingAmount"], 87)
        self.assertEqual(rider_row["codPending"], 1182)
        self.assertEqual(rider_row["netAdminPayable"], 0)
        self.assertEqual(rider_row["netRiderOwes"], 1095)

        with self.assertRaises(m.HTTPException) as missing_ref:
            m.admin_mark_invoice_paid(vendor_invoice.id, body={"method": "GPAY", "paymentReference": ""}, user=self.admin, db=self.db)
        self.assertEqual(missing_ref.exception.status_code, 400)

        paid_vendor = m.mark_invoice_paid(
            self.db,
            vendor_invoice.id,
            note="Paid after settlement smoke test",
            method="GPAY",
            payment_reference="UTR-TEST-001",
        )
        self.assertEqual(paid_vendor.status, "PAID")
        self.assertEqual(paid_vendor.pending_amount, 0)
        self.assertIsNotNone(paid_vendor.payout_locked_at)
        payment = self.db.query(m.SettlementPayment).filter_by(invoice_id=vendor_invoice.id).one()
        self.assertEqual(payment.payment_method, "GPAY")
        self.assertEqual(payment.payment_reference, "UTR-TEST-001")

        self.add_order(
            "LATE300",
            status=m.OrderStatusEnum.DELIVERED,
            payment="upi",
            product_value=300,
            delivery_fee=20,
            rider_earning=30,
            delivered_at=delivered_at,
        )
        m.sync_settlement_invoices(self.db)
        vendor_invoices = self.db.query(m.SettlementInvoice).filter_by(entity_type="vendor", shop_id=self.shop.id).all()
        self.assertEqual(len(vendor_invoices), 2)
        locked = next(i for i in vendor_invoices if i.id == vendor_invoice.id)
        adjustment = next(i for i in vendor_invoices if i.id != vendor_invoice.id)
        self.assertEqual(locked.net_payable, 1200)
        self.assertEqual(locked.status, "PAID")
        self.assertEqual(adjustment.net_payable, 300)
        self.assertEqual(adjustment.pending_amount, 300)

        pay_result = m.rider_cod_settlement_pay(
            m.RiderCodSettlementPay(amount=500, method="phonepe", paymentReference="COD-UTR-500"),
            user=self.rider,
            db=self.db,
        )
        self.assertTrue(pay_result["ok"])
        self.assertEqual(pay_result["summary"]["pendingAmount"], 682)
        cod_payment = self.db.query(m.SettlementPayment).filter_by(entity_type="rider_cod").one()
        self.assertEqual(cod_payment.payment_method, "PHONEPE")
        self.assertEqual(cod_payment.payment_reference, "COD-UTR-500")

    def test_cod_summary_excludes_uncollected_cod(self):
        m = self.main
        delivered_at = utc_now() - timedelta(hours=1)

        self.add_order(
            "COD-NOT-COLLECTED",
            status=m.OrderStatusEnum.DELIVERED,
            payment="cod",
            product_value=500,
            delivery_fee=20,
            rider_earning=40,
            delivered_at=delivered_at,
            cod_collected=False,
        )

        cod_summary = m.rider_cod_settlement_summary(self.db, self.rider)
        self.assertEqual(cod_summary["totalCollected"], 0)
        self.assertEqual(cod_summary["pendingAmount"], 0)
        self.assertEqual(cod_summary["totalCodOrders"], 0)

    def test_delivery_otp_finalizes_cod_and_timing(self):
        m = self.main
        delivered_at = utc_now() - timedelta(hours=1)
        order = self.add_order(
            "COD-OTP-FINALIZE",
            status=m.OrderStatusEnum.OUT_FOR_DELIVERY,
            payment="cod",
            product_value=500,
            delivery_fee=20,
            rider_earning=40,
            delivered_at=delivered_at,
            cod_collected=False,
        )
        order.delivery_deadline = utc_now() + timedelta(minutes=30)
        self.db.add(m.DeliveryOTP(order_id=order.id, otp="123456"))
        self.db.commit()

        result = m.verify_delivery_otp(order.id, {"otp": "123456"}, user=self.rider, db=self.db)
        self.assertTrue(result["ok"])
        self.db.refresh(order)
        self.assertEqual(order.status, m.OrderStatusEnum.DELIVERED)
        self.assertTrue(order.cod_collected)
        self.assertEqual(order.countdown_alert_level, "COMPLETED")
        self.assertEqual(order.rider_earning, 20)

    def test_rider_payout_never_exceeds_customer_delivery_fee(self):
        m = self.main
        delivered_at = utc_now() - timedelta(hours=1)

        order = self.add_order(
            "DELIVERY-CAP",
            status=m.OrderStatusEnum.DELIVERED,
            payment="upi",
            product_value=500,
            delivery_fee=30,
            rider_earning=42,
            delivered_at=delivered_at,
        )

        self.assertEqual(m.cap_rider_earning(order.rider_earning, order.delivery_fee), 30)
        m.sync_settlement_invoices(self.db)
        rider_invoice = self.db.query(m.SettlementInvoice).filter_by(entity_type="rider", user_id=self.rider.id).one()
        self.assertEqual(rider_invoice.delivery_collected, 30)
        self.assertEqual(rider_invoice.gross_earnings, 30)
        self.assertEqual(rider_invoice.pending_amount, 30)

        dashboard = m.admin_settlement_dashboard(self.db, delivered_at - timedelta(days=1), delivered_at + timedelta(days=1))
        rider_row = dashboard["riders"][0]
        self.assertEqual(rider_row["netAdminPayable"], 30)
        self.assertEqual(rider_row["netRiderOwes"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
