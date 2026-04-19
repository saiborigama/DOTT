const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "Sanathana analysis deck support";
pptx.subject = "Vehicle prices report summary";
pptx.title = "Vehicle Prices Intelligence Report - Feb 2026";
pptx.lang = "en-US";

const C = {
  blue: "4472C4",
  orange: "ED7D31",
  green: "70AD47",
  dark: "1F1F1F",
  grey: "6E6E6E",
  light: "F4F7FB",
  pale: "EAF1FB",
  white: "FFFFFF",
  line: "D9E2F3",
};

function footer(slide, text = "Vehicle Prices Intelligence Report  |  February 2026") {
  slide.addText(text, {
    x: 0.7,
    y: 7.0,
    w: 12,
    h: 0.2,
    fontSize: 10,
    color: C.grey,
    align: "center",
    margin: 0,
  });
}

function titleBlock(slide, title, subtitle) {
  slide.addText(title, {
    x: 0.8,
    y: 0.7,
    w: 8.8,
    h: 0.45,
    fontSize: 24,
    bold: true,
    color: C.dark,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.8,
      y: 1.18,
      w: 9.8,
      h: 0.22,
      fontSize: 11,
      color: C.grey,
      margin: 0,
    });
  }
  slide.addShape(pptx.ShapeType.line, {
    x: 0.8,
    y: 1.52,
    w: 11.6,
    h: 0,
    line: { color: C.blue, pt: 1.5 },
  });
}

function statBox(slide, x, y, num, label) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x,
    y,
    w: 2.3,
    h: 1.2,
    rectRadius: 0.06,
    line: { color: C.line, pt: 1 },
    fill: { color: C.white },
  });
  slide.addText(num, {
    x: x + 0.18,
    y: y + 0.18,
    w: 1.9,
    h: 0.35,
    fontSize: 24,
    bold: true,
    color: C.blue,
    align: "center",
    margin: 0,
  });
  slide.addText(label, {
    x: x + 0.15,
    y: y + 0.66,
    w: 2.0,
    h: 0.22,
    fontSize: 11,
    color: C.grey,
    align: "center",
    margin: 0,
  });
}

function bulletList(slide, items, x, y, w, h, fontSize = 16, color = C.dark) {
  slide.addText(
    items.map((item) => ({ text: item, options: { bullet: { indent: 14 } } })),
    {
      x,
      y,
      w,
      h,
      fontSize,
      color,
      breakLine: true,
      margin: 0.05,
      paraSpaceAfterPt: 8,
      valign: "top",
    }
  );
}

function numberedInsight(slide, n, title, body, x, y) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x,
    y,
    w: 0.42,
    h: 0.42,
    line: { color: C.orange, pt: 1 },
    fill: { color: C.orange },
  });
  slide.addText(String(n).padStart(2, "0"), {
    x: x + 0.05,
    y: y + 0.07,
    w: 0.32,
    h: 0.2,
    fontSize: 10,
    bold: true,
    color: C.white,
    align: "center",
    margin: 0,
  });
  slide.addText(title, {
    x: x + 0.58,
    y: y - 0.01,
    w: 5.0,
    h: 0.25,
    fontSize: 16,
    bold: true,
    color: C.dark,
    margin: 0,
  });
  slide.addText(body, {
    x: x + 0.58,
    y: y + 0.28,
    w: 5.35,
    h: 0.62,
    fontSize: 11,
    color: C.grey,
    margin: 0,
    valign: "top",
  });
}

const slide1 = pptx.addSlide();
slide1.background = { color: C.white };
slide1.addText("VEHICLE PRICES", {
  x: 1.0, y: 1.45, w: 4.8, h: 0.55, fontSize: 28, bold: true, color: C.blue, margin: 0,
});
slide1.addText("INTELLIGENCE REPORT", {
  x: 1.0, y: 2.05, w: 5.5, h: 0.42, fontSize: 24, bold: true, color: C.dark, margin: 0,
});
slide1.addText("Simple client summary built from the February 2026 vehicle price report", {
  x: 1.0, y: 2.7, w: 6.6, h: 0.24, fontSize: 13, color: C.grey, margin: 0,
});
slide1.addText("Common for all clients", {
  x: 1.0, y: 4.5, w: 2.5, h: 0.2, fontSize: 12, color: C.grey, margin: 0,
});
slide1.addText("Delivered as a 4-slide summary  |  Covering 2W, 4W and price-change implications", {
  x: 1.0, y: 6.25, w: 8.8, h: 0.2, fontSize: 11, color: C.grey, margin: 0,
});
slide1.addShape(pptx.ShapeType.rect, {
  x: 9.35, y: 1.2, w: 2.6, h: 4.8, line: { color: C.pale, pt: 1 }, fill: { color: C.pale },
});
slide1.addText("FEB", {
  x: 9.85, y: 2.0, w: 1.6, h: 0.55, fontSize: 30, bold: true, color: C.orange, align: "center", margin: 0,
});
slide1.addText("2026", {
  x: 9.85, y: 2.62, w: 1.6, h: 0.42, fontSize: 22, bold: true, color: C.blue, align: "center", margin: 0,
});
slide1.addText("29 OEMs tracked\n7 segments covered\n30 model moves cited", {
  x: 9.65, y: 3.55, w: 2.0, h: 1.2, fontSize: 14, bold: true, color: C.dark, align: "center", margin: 0,
});
footer(slide1, "Vehicle Prices Intelligence Report  |  February 2026  |  Confidential");

const slide2 = pptx.addSlide();
titleBlock(slide2, "Data Coverage & Purpose", "Vehicle Prices Intelligence Report  |  February 2026");
statBox(slide2, 0.95, 1.95, "29", "OEMs");
statBox(slide2, 3.55, 1.95, "7", "Segments");
statBox(slide2, 6.15, 1.95, "30", "Model moves");
statBox(slide2, 8.75, 1.95, "Monthly", "Jan 26 to Feb 26");
slide2.addText("SOURCES:", {
  x: 0.95, y: 4.05, w: 1.0, h: 0.22, fontSize: 12, bold: true, color: C.blue, margin: 0,
});
slide2.addText("OEM websites as cited in the original report.", {
  x: 1.82, y: 4.05, w: 4.6, h: 0.22, fontSize: 12, color: C.grey, margin: 0,
});
slide2.addText("OBJECTIVE:", {
  x: 0.95, y: 4.48, w: 1.15, h: 0.22, fontSize: 12, bold: true, color: C.blue, margin: 0,
});
slide2.addText(
  "To track OEM and model-level vehicle price movement, identify where price hikes are possible, and support pricing, sales and competitor strategy.",
  {
    x: 2.05, y: 4.48, w: 9.6, h: 0.55, fontSize: 12, color: C.grey, margin: 0,
  }
);
slide2.addText("CLIENT BENEFIT:", {
  x: 0.95, y: 5.25, w: 1.4, h: 0.22, fontSize: 12, bold: true, color: C.blue, margin: 0,
});
bulletList(
  slide2,
  [
    "Benchmark competitor pricing behavior quickly.",
    "Spot price-sensitive segments before demand is affected.",
    "Use model evidence in sales, planning and negotiation discussions.",
  ],
  2.15,
  5.15,
  9.2,
  1.15,
  13
);
footer(slide2);

const slide3 = pptx.addSlide();
titleBlock(slide3, "What Covers In Report", "Brand, segment and model-level movement covered in the PDF");
slide3.addText("REPORT COVERS 7 SEGMENTS", {
  x: 0.95, y: 1.9, w: 3.2, h: 0.25, fontSize: 16, bold: true, color: C.dark, margin: 0,
});
bulletList(
  slide3,
  [
    "Scooters",
    "Commuter bikes",
    "Premium bikes",
    "Entry & compact cars",
    "Mid-size cars & SUVs",
    "MUVs & vans",
    "EVs",
  ],
  1.0,
  2.25,
  3.3,
  2.6,
  15
);
slide3.addText("TOP OEM / BRAND MOVERS", {
  x: 4.8, y: 1.9, w: 3.2, h: 0.25, fontSize: 16, bold: true, color: C.dark, margin: 0,
});
bulletList(
  slide3,
  [
    "Nissan +1.6%",
    "Toyota +0.7%",
    "Bajaj +0.6%",
    "Suzuki +0.5%",
    "Land Rover +0.4%",
    "Royal Enfield -0.5%",
    "TVS -0.4%",
  ],
  4.85,
  2.25,
  3.0,
  2.6,
  15
);
slide3.addText("TOP MODEL MOVES", {
  x: 8.55, y: 1.9, w: 2.5, h: 0.25, fontSize: 16, bold: true, color: C.dark, margin: 0,
});
bulletList(
  slide3,
  [
    "Pulsar 150 +4.7%",
    "Pulsar 125 +4.0%",
    "Burgman Street Ride +3.6%",
    "Range Rover Velar +3.4%",
    "Hyundai Exter +3.0%",
    "Nissan Magnite MT +2.5%",
    "TVS Raider -1.8%",
    "TVS XL100 -1.5%",
  ],
  8.6,
  2.25,
  3.2,
  3.0,
  14
);
slide3.addText("Note: Most other tracked OEMs were flat month on month.", {
  x: 0.95,
  y: 6.25,
  w: 6.6,
  h: 0.22,
  fontSize: 12,
  color: C.grey,
  margin: 0,
});
footer(slide3);

const slide4 = pptx.addSlide();
titleBlock(slide4, "Insights For Business Strategy", "What price increase linkage means for the client");
numberedInsight(
  slide4,
  1,
  "Affordability segments are most sensitive",
  "Scooters, commuter bikes, entry cars and EVs stayed mostly flat in the report, which suggests demand can weaken quickly if prices rise too aggressively.",
  0.95,
  1.9
);
numberedInsight(
  slide4,
  2,
  "Selective hikes work where elasticity is stronger",
  "Nissan, Toyota, Land Rover, Bajaj and Suzuki were able to take targeted increases, showing better pass-through potential in selected products.",
  0.95,
  3.05
);
numberedInsight(
  slide4,
  3,
  "Premium positioning can absorb cost differently",
  "Premium bikes still showed net declines, meaning brands may protect aspiration and volume first, then recover margin through mix or features later.",
  0.95,
  4.2
);
numberedInsight(
  slide4,
  4,
  "Use the report as an early warning tool",
  "If input costs rise again, compare competitor actions by segment before changing price. In sensitive segments, finance offers and exchange schemes may work better than direct hikes.",
  0.95,
  5.35
);
footer(slide4, "Vehicle Prices Intelligence Report  |  Built from the supplied PDF only  |  Confidential");

pptx.writeFile({ fileName: "C:/Users/Admin/Documents/Code X/SAI-01/Vehicle_Pricing_Client_Deck_Feb2026_Simple.pptx" });
