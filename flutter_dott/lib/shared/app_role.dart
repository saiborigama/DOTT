enum AppRole {
  customer('CUSTOMER', 'DOTT'),
  vendor('OWNER', 'DOTT Vendor'),
  rider('RIDER', 'DOTT Rider');

  const AppRole(this.apiRole, this.title);

  final String apiRole;
  final String title;
}
