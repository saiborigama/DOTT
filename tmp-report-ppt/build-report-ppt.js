const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "OpenAI Codex";
pptx.company = "Sanathana analysis deck support";
pptx.subject = "Vehicle price movement insights, Feb 2026";
pptx.title = "Client Benefits from Vehicle Prices Report - Feb 2026";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US",
};

const colors = {
  navy: "173B73",
  blue: "2C7BE5",
  sky: "DCEEFF",
  teal: "00A7C4",
  green: "1E9E62",
  red: "D64545",
  amber: "F4B000",
  text: "1F2937",
  muted: "6B7280",
  line: "D6DCE5",
  soft: "F7FAFC",
  white: "FFFFFF",
};

function addHeader(slide, title, subtitle) {
  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.55,
    line: { color: colors.navy, transparency: 100 },
    fill: { color: colors.navy },
  });
  slide.addText(title, {
    x: 0.45,
    y: 0.72,
    w: 8.8,
    h: 0.45,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: colors.navy,
    margin: 0,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.47,
      y: 1.14,
      w: 9.8,
      h: 0.28,
      fontSize: 9.5,
      color: colors.muted,
      margin: 0,
    });
  }
}

function addFooter(slide, text) {
  slide.addText(text, {
    x: 0.45,
    y: 7.12,
    w: 12.3,
    h: 0.18,
    fontSize: 8,
    color: colors.muted,
    align: "right",
    margin: 0,
  });
}

function addCard(slide, opts) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    rectRadius: 0.08,
    line: { color: opts.lineColor || colors.line, pt: 1 },
    fill: { color: opts.fillColor || colors.white },
  });
}

function addBulletList(slide, items, x, y, w, h, fontSize = 16, color = colors.text) {
  slide.addText(
    items.map((item) => ({
      text: item,
      options: { bullet: { indent: 14 } },
    })),
    {
      x,
      y,
      w,
      h,
      fontSize,
      color,
      breakLine: true,
      margin: 0.08,
      paraSpaceAfterPt: 8,
      valign: "top",
    }
  );
}

function addSectionLabel(slide, text, x, y, w) {
  slide.addText(text, {
    x,
    y,
    w,
    h: 0.25,
    fontSize: 10,
    bold: true,
    color: colors.blue,
    margin: 0,
  });
}

const oemTopIncreases = [
  "Nissan: +1.6% average maker price change",
  "Toyota: +0.7%",
  "Bajaj: +0.6%",
  "Suzuki: +0.5%",
  "Land Rover: +0.4%",
];

const oemTopDecreases = [
  "Royal Enfield: -0.5%",
  "TVS: -0.4%",
  "Most other tracked OEMs: flat month on month",
];

const modelTopMoves = [
  "Bajaj Pulsar 150: +4.7%",
  "Bajaj Pulsar 125: +4.0%",
  "Burgman Street Ride: +3.6%",
  "Range Rover Velar: +3.4%",
  "Hyundai Exter: +3.0%",
  "Nissan Magnite MT: +2.5%",
  "Urban Cruiser Taisor: +2.4%",
  "TVS Raider: -1.8%",
  "TVS XL100: -1.5%",
  "Classic 350 / Bear 650 / Shotgun 650: -1.0%",
];

const slide1 = pptx.addSlide();
addHeader(
  slide1,
  "How The Client Benefits From This Report",
  "Vehicle Prices Report, February 2026 | Jan 2026 to Feb 2026 price movement summary"
);

addCard(slide1, { x: 0.45, y: 1.55, w: 4.08, h: 1.1, fillColor: "EEF6FF", lineColor: "B9D6FF" });
addCard(slide1, { x: 4.63, y: 1.55, w: 4.08, h: 1.1, fillColor: "F0FFF8", lineColor: "BFE9D2" });
addCard(slide1, { x: 8.81, y: 1.55, w: 4.08, h: 1.1, fillColor: "FFF8EA", lineColor: "F3D9A4" });

slide1.addText("29 OEMs", {
  x: 0.72, y: 1.82, w: 1.6, h: 0.28, fontSize: 22, bold: true, color: colors.navy, margin: 0,
});
slide1.addText("tracked across 2W and 4W", {
  x: 0.72, y: 2.12, w: 2.6, h: 0.2, fontSize: 10, color: colors.muted, margin: 0,
});

slide1.addText("7 segments", {
  x: 4.9, y: 1.82, w: 1.7, h: 0.28, fontSize: 22, bold: true, color: colors.green, margin: 0,
});
slide1.addText("from scooters to EVs and MUVs", {
  x: 4.9, y: 2.12, w: 2.6, h: 0.2, fontSize: 10, color: colors.muted, margin: 0,
});

slide1.addText("30 model moves", {
  x: 9.08, y: 1.82, w: 1.9, h: 0.28, fontSize: 22, bold: true, color: colors.amber, margin: 0,
});
slide1.addText("explicitly cited in the report", {
  x: 9.08, y: 2.12, w: 2.7, h: 0.2, fontSize: 10, color: colors.muted, margin: 0,
});

addCard(slide1, { x: 0.45, y: 2.95, w: 6.1, h: 3.55, fillColor: colors.white });
addSectionLabel(slide1, "CLIENT VALUE", 0.7, 3.18, 2.0);
addBulletList(
  slide1,
  [
    "Shows where OEMs are absorbing input-cost inflation versus passing it through to the market.",
    "Helps sales and pricing teams identify the most price-sensitive segments: scooters, commuter bikes, entry cars and EVs.",
    "Supports competitor benchmarking by showing which brands kept prices flat and which took selective hikes.",
    "Improves negotiation, forecasting and campaign planning with model-level evidence, not only brand averages.",
  ],
  0.68,
  3.45,
  5.6,
  2.75,
  15
);

addCard(slide1, { x: 6.8, y: 2.95, w: 6.08, h: 3.55, fillColor: colors.soft });
addSectionLabel(slide1, "KEY TAKEAWAYS FROM THE REPORT", 7.05, 3.18, 3.2);
addBulletList(
  slide1,
  [
    "Affordability protection is the main market theme: many entry and mass segments stayed flat despite metal inflation.",
    "Selective price recovery is visible only where elasticity is stronger, especially Nissan, Toyota, Land Rover, Bajaj and Suzuki.",
    "Premium bikes still saw net declines, signaling strong cost absorption to protect aspiration-led demand.",
    "EV pricing stayed flat even with sharp cobalt inflation, which highlights how sensitive EV adoption remains.",
  ],
  7.02,
  3.45,
  5.6,
  2.75,
  15
);

addFooter(slide1, "Source: Sanathana Vehicle Prices Report February 2026, based on OEM websites");

const slide2 = pptx.addSlide();
addHeader(
  slide2,
  "Coverage, OEM Count And Top Movers",
  "Brand/OEM detail captured from the report tables and model evidence"
);

addCard(slide2, { x: 0.45, y: 1.55, w: 2.15, h: 1.15, fillColor: "EEF6FF", lineColor: "B9D6FF" });
addCard(slide2, { x: 2.78, y: 1.55, w: 2.15, h: 1.15, fillColor: "EEF6FF", lineColor: "B9D6FF" });
addCard(slide2, { x: 5.11, y: 1.55, w: 2.15, h: 1.15, fillColor: "EEF6FF", lineColor: "B9D6FF" });
addCard(slide2, { x: 7.44, y: 1.55, w: 2.15, h: 1.15, fillColor: "EEF6FF", lineColor: "B9D6FF" });
addCard(slide2, { x: 9.77, y: 1.55, w: 2.65, h: 1.15, fillColor: "EEF6FF", lineColor: "B9D6FF" });

[
  ["12", "2W OEMs"],
  ["17", "4W OEMs"],
  ["7", "Segments"],
  ["30", "Named model price moves"],
  ["Jan-Feb 2026", "Observation window"],
].forEach((item, idx) => {
  const xs = [0.72, 3.05, 5.38, 7.71, 10.02];
  const ws = [1.6, 1.6, 1.6, 1.8, 2.0];
  slide2.addText(item[0], {
    x: xs[idx], y: 1.82, w: ws[idx], h: 0.28, fontSize: idx === 4 ? 18 : 24, bold: true, color: colors.navy, margin: 0, align: idx === 4 ? "center" : "left",
  });
  slide2.addText(item[1], {
    x: xs[idx], y: 2.12, w: ws[idx], h: 0.2, fontSize: 9.5, color: colors.muted, margin: 0, align: idx === 4 ? "center" : "left",
  });
});

addCard(slide2, { x: 0.45, y: 3.0, w: 4.1, h: 3.65, fillColor: colors.white });
addCard(slide2, { x: 4.62, y: 3.0, w: 3.85, h: 3.65, fillColor: colors.white });
addCard(slide2, { x: 8.55, y: 3.0, w: 4.33, h: 3.65, fillColor: colors.white });

addSectionLabel(slide2, "SEGMENTS COVERED", 0.7, 3.22, 2.2);
addBulletList(
  slide2,
  [
    "Scooters",
    "Commuter bikes",
    "Premium bikes",
    "Entry and compact cars",
    "Mid-size cars and SUVs",
    "MUVs and vans",
    "EVs",
  ],
  0.68,
  3.48,
  3.55,
  2.85,
  15
);

addSectionLabel(slide2, "TOP OEM / BRAND INCREASES", 4.87, 3.22, 2.6);
addBulletList(slide2, oemTopIncreases, 4.84, 3.48, 3.35, 1.9, 14.5, colors.green);
addSectionLabel(slide2, "TOP OEM / BRAND DECREASES", 4.87, 5.2, 2.6);
addBulletList(slide2, oemTopDecreases, 4.84, 5.45, 3.35, 0.95, 14.5, colors.red);

addSectionLabel(slide2, "TOP 10 MODEL MOVES MENTIONED", 8.8, 3.22, 3.0);
addBulletList(slide2, modelTopMoves, 8.78, 3.48, 3.75, 2.9, 13.5);

addFooter(slide2, "Counts are based on OEM tables plus explicit model-level evidence shown in the report");

const slide3 = pptx.addSlide();
addHeader(
  slide3,
  "Pricing Linkage: If Prices Increase, What Happens?",
  "Commercial implication map based on the segments highlighted in the report"
);

addCard(slide3, { x: 0.55, y: 1.55, w: 2.8, h: 4.9, fillColor: "EEF6FF", lineColor: "B9D6FF" });
addCard(slide3, { x: 3.7, y: 1.55, w: 2.8, h: 4.9, fillColor: "F7FAFC", lineColor: colors.line });
addCard(slide3, { x: 6.85, y: 1.55, w: 2.8, h: 4.9, fillColor: "F0FFF8", lineColor: "BFE9D2" });
addCard(slide3, { x: 10.0, y: 1.55, w: 2.8, h: 4.9, fillColor: "FFF8EA", lineColor: "F3D9A4" });

slide3.addText("1. Input-cost pressure", {
  x: 0.82, y: 1.85, w: 2.1, h: 0.28, fontSize: 18, bold: true, color: colors.navy, margin: 0,
});
addBulletList(
  slide3,
  [
    "Aluminium, copper and cobalt inflation raise OEM cost base.",
    "Mass segments face the toughest choice: absorb cost or risk demand loss.",
  ],
  0.8,
  2.25,
  2.15,
  1.9,
  14
);

slide3.addText("2. OEM pricing response", {
  x: 3.96, y: 1.85, w: 2.2, h: 0.28, fontSize: 18, bold: true, color: colors.navy, margin: 0,
});
addBulletList(
  slide3,
  [
    "Affordable segments typically stay flat or see very selective hikes.",
    "Premium and utility-led products are more likely to carry modest price increases.",
  ],
  3.94,
  2.25,
  2.15,
  1.9,
  14
);

slide3.addText("3. Market effect", {
  x: 7.1, y: 1.85, w: 1.8, h: 0.28, fontSize: 18, bold: true, color: colors.green, margin: 0,
});
addBulletList(
  slide3,
  [
    "Higher prices in scooters, commuter bikes, entry cars and EVs can slow volumes quickly.",
    "Feature-led premiumisation can soften the impact in SUVs, MUVs and premium bikes.",
  ],
  7.08,
  2.25,
  2.15,
  1.9,
  14
);

slide3.addText("4. Client action", {
  x: 10.24, y: 1.85, w: 1.8, h: 0.28, fontSize: 18, bold: true, color: "A56600", margin: 0,
});
addBulletList(
  slide3,
  [
    "Track elastic segments weekly and use offers, finance or exchange benefits before large price hikes.",
    "Use selective competitor-led benchmarking to decide where margin recovery is realistic.",
  ],
  10.22,
  2.25,
  2.15,
  1.9,
  14
);

slide3.addText("Most likely impact by segment", {
  x: 0.7, y: 5.05, w: 2.6, h: 0.22, fontSize: 12, bold: true, color: colors.blue, margin: 0,
});
addBulletList(
  slide3,
  [
    "Highest demand risk: scooters, commuter bikes, entry cars, EVs",
    "Moderate risk: mid-size cars and SUVs",
    "Better pass-through potential: MUVs, vans, luxury SUVs and selected premium bikes",
  ],
  0.68,
  5.32,
  12.0,
  0.9,
  14
);

slide3.addText("Input cost inflation -> selective pricing -> volume / mix impact -> action plan", {
  x: 1.1,
  y: 6.45,
  w: 11.2,
  h: 0.28,
  fontSize: 20,
  bold: true,
  color: colors.navy,
  align: "center",
  margin: 0,
});
addFooter(slide3, "Inference slide built from the price-move evidence and summary statements in the report");

const slide4 = pptx.addSlide();
addHeader(
  slide4,
  "Sources And Method Notes",
  "Use this slide as the reference page in client conversations"
);

addCard(slide4, { x: 0.55, y: 1.55, w: 6.05, h: 4.95, fillColor: colors.white });
addCard(slide4, { x: 6.78, y: 1.55, w: 6.0, h: 4.95, fillColor: colors.soft });

addSectionLabel(slide4, "PRIMARY SOURCE", 0.82, 1.82, 2.0);
addBulletList(
  slide4,
  [
    "Sanathana, Vehicle Prices Report February 2026.",
    "Observation window stated in the report: Jan 2026 to Feb 2026.",
    "PDF creation date in file metadata: 3 March 2026.",
  ],
  0.8,
  2.1,
  5.35,
  1.2,
  15
);

addSectionLabel(slide4, "UNDERLYING DATA SOURCE", 0.82, 3.45, 2.5);
addBulletList(
  slide4,
  [
    "OEM websites, as cited on the 2W and 4W table pages in the report.",
    "Model-level evidence includes examples such as Pulsar 150, Burgman Street Ride, Magnite MT, Glanza and Range Rover Velar.",
  ],
  0.8,
  3.72,
  5.35,
  1.45,
  15
);

addSectionLabel(slide4, "HOW THIS DECK WAS BUILT", 7.05, 1.82, 2.4);
addBulletList(
  slide4,
  [
    "Slide 1 summarizes client benefits and the report's core strategic signals.",
    "Slide 2 counts OEM coverage, segments and the strongest brand/model price movements.",
    "Slide 3 provides business linkage on likely effects of future price increases.",
    "All analysis is based only on the PDF content; no external market-share or volume dataset was added.",
  ],
  7.03,
  2.1,
  5.25,
  2.3,
  15
);

addSectionLabel(slide4, "IMPORTANT LIMITATION", 7.05, 4.9, 2.4);
addBulletList(
  slide4,
  [
    "The report tracks price movements, not actual sales or market share changes.",
    "Linkage conclusions are directional implications, not causal proof.",
  ],
  7.03,
  5.18,
  5.15,
  0.95,
  15
);

addFooter(slide4, "Prepared from the supplied PDF only | Deck created in PowerPoint format");

pptx.writeFile({ fileName: "C:/Users/Admin/Documents/Code X/SAI-01/tmp-report-ppt/Vehicle_Pricing_Client_Deck_Feb2026.pptx" });
