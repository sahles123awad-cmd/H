import { db, zonesTable, usersTable, ordersTable, ratingsTable, notificationsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { hashPassword, generateTrackingToken } from "./auth";
import { logger } from "./logger";

const ZONES: Array<{ nameAr: string; nameEn: string; governorate: string; region: string }> = [
  // Amman West
  { nameAr: "عبدون", nameEn: "Abdoun", governorate: "عمان", region: "west" },
  { nameAr: "الصويفية", nameEn: "Al-Sweifieh", governorate: "عمان", region: "west" },
  { nameAr: "الشميساني", nameEn: "Al-Shmaisani", governorate: "عمان", region: "west" },
  { nameAr: "الرابية", nameEn: "Al-Rabieh", governorate: "عمان", region: "west" },
  { nameAr: "خلدا", nameEn: "Khilda", governorate: "عمان", region: "west" },
  { nameAr: "اللويبدة", nameEn: "Al-Luweibdeh", governorate: "عمان", region: "west" },
  { nameAr: "الجبيهة", nameEn: "Al-Jubaiha", governorate: "عمان", region: "west" },
  { nameAr: "الجامعة الأردنية", nameEn: "University of Jordan", governorate: "عمان", region: "west" },
  { nameAr: "تلاع العلي", nameEn: "Al-Tla'a Al-Ali", governorate: "عمان", region: "west" },
  { nameAr: "شارع مكة", nameEn: "Mecca St", governorate: "عمان", region: "west" },
  { nameAr: "شارع الملكة رانيا", nameEn: "Queen Rania St", governorate: "عمان", region: "west" },
  { nameAr: "أم أذينة", nameEn: "Um Uthaina", governorate: "عمان", region: "west" },
  { nameAr: "أم سماق", nameEn: "Um Summaq", governorate: "عمان", region: "west" },
  { nameAr: "دير غبار", nameEn: "Deir Ghbar", governorate: "عمان", region: "west" },
  { nameAr: "الحدائق", nameEn: "Gardens (Hada'ek)", governorate: "عمان", region: "west" },
  { nameAr: "الرينبو", nameEn: "Rainbow Street", governorate: "عمان", region: "west" },
  { nameAr: "المدينة الرياضية", nameEn: "Al-Madina Al-Riyadhiyeh", governorate: "عمان", region: "west" },
  { nameAr: "جبل الحسين", nameEn: "Jabal Al-Hussein", governorate: "عمان", region: "west" },
  { nameAr: "أبو نصير", nameEn: "Abu Nsair", governorate: "عمان", region: "west" },
  { nameAr: "الماصيف", nameEn: "Al-Maseef", governorate: "عمان", region: "west" },
  // Amman East
  { nameAr: "الهاشمي الشمالي", nameEn: "Al-Hashmi Al-Shamali", governorate: "عمان", region: "east" },
  { nameAr: "الهاشمي الجنوبي", nameEn: "Al-Hashmi Al-Janubi", governorate: "عمان", region: "east" },
  { nameAr: "الماركة", nameEn: "Al-Marka", governorate: "عمان", region: "east" },
  { nameAr: "جبل التاج", nameEn: "Jabal Al-Taj", governorate: "عمان", region: "east" },
  { nameAr: "الرصيفة", nameEn: "Al-Rusaifa", governorate: "عمان", region: "east" },
  { nameAr: "السحاب", nameEn: "Al-Sahab", governorate: "عمان", region: "east" },
  // Amman Central
  { nameAr: "الدوار الأول", nameEn: "1st Circle", governorate: "عمان", region: "central" },
  { nameAr: "الدوار الثاني", nameEn: "2nd Circle", governorate: "عمان", region: "central" },
  { nameAr: "الدوار الثالث", nameEn: "3rd Circle", governorate: "عمان", region: "central" },
  { nameAr: "الدوار الرابع", nameEn: "4th Circle", governorate: "عمان", region: "central" },
  { nameAr: "الدوار الخامس", nameEn: "5th Circle", governorate: "عمان", region: "central" },
  { nameAr: "الدوار السادس", nameEn: "6th Circle", governorate: "عمان", region: "central" },
  { nameAr: "الدوار السابع", nameEn: "7th Circle", governorate: "عمان", region: "central" },
  { nameAr: "البلد", nameEn: "Al-Balad (Downtown)", governorate: "عمان", region: "central" },
  { nameAr: "شارع الملك فيصل", nameEn: "King Faisal St", governorate: "عمان", region: "central" },
  // Amman North
  { nameAr: "شفا بدران", nameEn: "Shafa Badran", governorate: "عمان", region: "north" },
  { nameAr: "مرج الحمام", nameEn: "Marj Al-Hamam", governorate: "عمان", region: "north" },
  { nameAr: "وادي السير", nameEn: "Wadi Al-Seer", governorate: "عمان", region: "north" },
  { nameAr: "طبربور", nameEn: "Tabarbour", governorate: "عمان", region: "north" },
  // Amman South
  { nameAr: "ناعور", nameEn: "Naur", governorate: "عمان", region: "south" },
  { nameAr: "الجيزة", nameEn: "Al-Jiza", governorate: "عمان", region: "south" },
  // Zarqa
  { nameAr: "الزرقاء الجديدة", nameEn: "Al-Zarqa Al-Jadida", governorate: "الزرقاء", region: "central" },
  { nameAr: "الزرقاء القديمة", nameEn: "Al-Zarqa Al-Qadima", governorate: "الزرقاء", region: "central" },
  // Irbid
  { nameAr: "وسط إربد", nameEn: "Irbid City Center", governorate: "إربد", region: "central" },
  { nameAr: "الرمثا", nameEn: "Al-Ramtha", governorate: "إربد", region: "central" },
  // Aqaba
  { nameAr: "وسط العقبة", nameEn: "Aqaba City Center", governorate: "العقبة", region: "central" },
  // Madaba
  { nameAr: "وسط مادبا", nameEn: "Madaba City Center", governorate: "مادبا", region: "central" },
  // Balqa
  { nameAr: "مدينة السلط", nameEn: "Al-Salt City", governorate: "البلقاء", region: "central" },
  // Karak
  { nameAr: "وسط الكرك", nameEn: "Karak City Center", governorate: "الكرك", region: "central" },
  // Jerash
  { nameAr: "وسط جرش", nameEn: "Jerash City Center", governorate: "جرش", region: "central" },
  // Amman West (extra)
  { nameAr: "الكرسي", nameEn: "Al-Kursi", governorate: "عمان", region: "west" },
  { nameAr: "بيادر وادي السير", nameEn: "Bayadir Wadi Al-Seer", governorate: "عمان", region: "west" },
  { nameAr: "أم الحيران", nameEn: "Um Al-Hairan", governorate: "عمان", region: "west" },
  { nameAr: "بدر", nameEn: "Badr", governorate: "عمان", region: "west" },
  { nameAr: "الرومي", nameEn: "Al-Roumi", governorate: "عمان", region: "west" },
  { nameAr: "اليادودة", nameEn: "Al-Yadouda", governorate: "عمان", region: "west" },
  { nameAr: "أبو علندا", nameEn: "Abu Alanda", governorate: "عمان", region: "west" },
  { nameAr: "القسطل", nameEn: "Al-Qastal", governorate: "عمان", region: "south" },
  // Amman North (extra)
  { nameAr: "تلول الذهب", nameEn: "Tulul Al-Dhahab", governorate: "عمان", region: "north" },
  { nameAr: "الجوفة", nameEn: "Al-Joufa", governorate: "عمان", region: "north" },
  { nameAr: "البقعة", nameEn: "Al-Baqa'a", governorate: "عمان", region: "north" },
  { nameAr: "الدمينة", nameEn: "Al-Daminah", governorate: "عمان", region: "north" },
  // Amman East (extra)
  { nameAr: "مخيم الوحدات", nameEn: "Wehdat Camp", governorate: "عمان", region: "east" },
  { nameAr: "النزهة", nameEn: "Al-Nuzha", governorate: "عمان", region: "east" },
  { nameAr: "ماركا الجنوبية", nameEn: "Marka South", governorate: "عمان", region: "east" },
  { nameAr: "ماركا الشمالية", nameEn: "Marka North", governorate: "عمان", region: "east" },
  { nameAr: "القويسمة", nameEn: "Al-Qwaisma", governorate: "عمان", region: "east" },
  { nameAr: "خريبة السوق", nameEn: "Khraybat Al-Souq", governorate: "عمان", region: "east" },
  { nameAr: "اليرموك", nameEn: "Al-Yarmouk", governorate: "عمان", region: "east" },
  { nameAr: "عين غزال", nameEn: "Ain Ghazal", governorate: "عمان", region: "east" },
  // Amman Central (extra)
  { nameAr: "الدوار الثامن", nameEn: "8th Circle", governorate: "عمان", region: "central" },
  { nameAr: "جبل عمان", nameEn: "Jabal Amman", governorate: "عمان", region: "central" },
  { nameAr: "متحف الأردن", nameEn: "Jordan Museum Area", governorate: "عمان", region: "central" },
  // Zarqa (extra)
  { nameAr: "ضاحية الأمير الحسن", nameEn: "Prince Hassan District", governorate: "الزرقاء", region: "central" },
  { nameAr: "الهاشمية", nameEn: "Al-Hashimiyya", governorate: "الزرقاء", region: "central" },
  { nameAr: "الزواهرة", nameEn: "Al-Zawahira", governorate: "الزرقاء", region: "central" },
  { nameAr: "الزرقاء الصناعية", nameEn: "Zarqa Industrial", governorate: "الزرقاء", region: "central" },
  { nameAr: "الرصيفة الشرقية", nameEn: "Rusaifa East", governorate: "الزرقاء", region: "east" },
  // Irbid (extra)
  { nameAr: "وسط جامعة اليرموك", nameEn: "Yarmouk University Area", governorate: "إربد", region: "central" },
  { nameAr: "المزار الشمالي", nameEn: "Al-Mazar Al-Shamali", governorate: "إربد", region: "north" },
  { nameAr: "الحصن", nameEn: "Al-Husn", governorate: "إربد", region: "central" },
  { nameAr: "بيت راس", nameEn: "Beit Ras", governorate: "إربد", region: "central" },
  { nameAr: "كفر آسد", nameEn: "Kufr Asad", governorate: "إربد", region: "central" },
  { nameAr: "الأغوار الشمالية", nameEn: "North Ghor", governorate: "إربد", region: "west" },
  // Aqaba (extra)
  { nameAr: "العقبة السياحية", nameEn: "Aqaba Tourist Area", governorate: "العقبة", region: "central" },
  { nameAr: "المنطقة الاقتصادية الخاصة", nameEn: "ASEZA Zone", governorate: "العقبة", region: "central" },
  { nameAr: "الشاطئ الجنوبي", nameEn: "South Beach Aqaba", governorate: "العقبة", region: "south" },
  // Mafraq
  { nameAr: "وسط المفرق", nameEn: "Mafraq City Center", governorate: "المفرق", region: "central" },
  { nameAr: "الرويشد", nameEn: "Al-Ruwayshid", governorate: "المفرق", region: "east" },
  // Karak (extra)
  { nameAr: "الغور الجنوبي", nameEn: "South Ghor", governorate: "الكرك", region: "west" },
  { nameAr: "قصبة الكرك", nameEn: "Karak Castle Area", governorate: "الكرك", region: "central" },
  // Ajloun
  { nameAr: "وسط عجلون", nameEn: "Ajloun City Center", governorate: "عجلون", region: "central" },
  { nameAr: "عجلون الغابات", nameEn: "Ajloun Forest", governorate: "عجلون", region: "north" },
  // Jerash (extra)
  { nameAr: "الجرش الأثري", nameEn: "Jerash Archaeological Site", governorate: "جرش", region: "central" },
  { nameAr: "بورما", nameEn: "Burma", governorate: "جرش", region: "central" },
  // Tafileh
  { nameAr: "وسط الطفيلة", nameEn: "Tafileh City Center", governorate: "الطفيلة", region: "central" },
  { nameAr: "بصيرا", nameEn: "Busaira", governorate: "الطفيلة", region: "central" },
  // Maan
  { nameAr: "وسط معان", nameEn: "Maan City Center", governorate: "معان", region: "central" },
  { nameAr: "وادي رم", nameEn: "Wadi Rum", governorate: "معان", region: "south" },
  { nameAr: "البتراء", nameEn: "Petra", governorate: "معان", region: "central" },
];

export async function seed() {
  // Only seed zones — users/orders/ratings are created through the real app
  const [existingZones] = await db.select({ count: count() }).from(zonesTable);
  if (existingZones.count > 0) {
    logger.info("Zones already seeded, skipping");
    return;
  }

  logger.info("Seeding database...");

  // Insert zones only
  const insertedZones = await db.insert(zonesTable).values(ZONES).returning();
  const abdounZone = insertedZones.find(z => z.nameEn === "Abdoun")!;
  const sweifiehZone = insertedZones.find(z => z.nameEn === "Al-Sweifieh")!;
  const shmaisaniZone = insertedZones.find(z => z.nameEn === "Al-Shmaisani")!;
  const rabieZone = insertedZones.find(z => z.nameEn === "Al-Rabieh")!;
  const khildaZone = insertedZones.find(z => z.nameEn === "Khilda")!;
  const circle3Zone = insertedZones.find(z => z.nameEn === "3rd Circle")!;
  const circle4Zone = insertedZones.find(z => z.nameEn === "4th Circle")!;
  const downtownZone = insertedZones.find(z => z.nameEn === "Al-Balad (Downtown)")!;

  // Insert users
  const [manager] = await db.insert(usersTable).values({
    fullName: "أحمد الخالدي",
    phone: "0791234567",
    email: "manager@yalla.jo",
    passwordHash: hashPassword("Manager123!"),
    role: "manager",
    status: "available",
  }).returning();

  const driverData = [
    { fullName: "محمد العمري", phone: "0791111001", email: "driver1@yalla.jo", zoneId: abdounZone.id },
    { fullName: "خالد النسور", phone: "0791111002", email: "driver2@yalla.jo", zoneId: sweifiehZone.id },
    { fullName: "سامي الزعبي", phone: "0791111003", email: "driver3@yalla.jo", zoneId: shmaisaniZone.id },
    { fullName: "عمر الحوراني", phone: "0791111004", email: "driver4@yalla.jo", zoneId: rabieZone.id },
    { fullName: "يوسف البطاينة", phone: "0791111005", email: "driver5@yalla.jo", zoneId: khildaZone.id },
    { fullName: "إبراهيم الشرع", phone: "0791111006", email: "driver6@yalla.jo", zoneId: circle3Zone.id },
    { fullName: "حسين القضاة", phone: "0791111007", email: "driver7@yalla.jo", zoneId: circle4Zone.id },
    { fullName: "علاء الدين رشيد", phone: "0791111008", email: "driver8@yalla.jo", zoneId: downtownZone.id },
  ];

  const drivers = await db.insert(usersTable).values(
    driverData.map(d => ({
      ...d,
      passwordHash: hashPassword("Driver123!"),
      role: "driver" as const,
      status: "available" as const,
    }))
  ).returning();

  // Insert orders
  const orderData = [
    {
      orderId: "YW-2026-0001", fromBusiness: "مطعم الزيتونة", fromAddress: "شارع الرينبو", fromZoneId: abdounZone.id,
      toCustomerName: "ليلى منصور", toPhone: "0799001001", toAddress: "خلف البنك العربي", toZoneId: sweifiehZone.id,
      priority: "urgent" as const, status: "delivered" as const, driverId: drivers[0].id,
      trackingToken: generateTrackingToken(), assignedAt: new Date(Date.now() - 3 * 3600000),
      pickedAt: new Date(Date.now() - 2 * 3600000), deliveredAt: new Date(Date.now() - 1 * 3600000),
    },
    {
      orderId: "YW-2026-0002", fromBusiness: "صيدلية الأمل", fromAddress: "الدوار الثالث", fromZoneId: circle3Zone.id,
      toCustomerName: "ناصر حداد", toPhone: "0799001002", toAddress: "مقابل الجامعة الأردنية", toZoneId: insertedZones.find(z => z.nameEn === "University of Jordan")!.id,
      priority: "normal" as const, status: "assigned" as const, driverId: drivers[1].id,
      trackingToken: generateTrackingToken(), assignedAt: new Date(Date.now() - 30 * 60000),
    },
    {
      orderId: "YW-2026-0003", fromBusiness: "بقالة النور", fromAddress: "شارع الشميساني", fromZoneId: shmaisaniZone.id,
      toCustomerName: "فاطمة العزام", toPhone: "0799001003", toAddress: "برج الملكة", toZoneId: rabieZone.id,
      priority: "normal" as const, status: "picked" as const, driverId: drivers[2].id,
      trackingToken: generateTrackingToken(), assignedAt: new Date(Date.now() - 45 * 60000),
      pickedAt: new Date(Date.now() - 20 * 60000),
    },
    {
      orderId: "YW-2026-0004", fromBusiness: "مكتبة الفكر", fromAddress: "شارع مكة", fromZoneId: insertedZones.find(z => z.nameEn === "Mecca St")!.id,
      toCustomerName: "رامي سرحان", toPhone: "0799001004", toAddress: "الدوار الرابع", toZoneId: circle4Zone.id,
      priority: "normal" as const, status: "pending" as const,
      trackingToken: generateTrackingToken(),
    },
    {
      orderId: "YW-2026-0005", fromBusiness: "مطبخ الستات", fromAddress: "اللويبدة", fromZoneId: insertedZones.find(z => z.nameEn === "Al-Luweibdeh")!.id,
      toCustomerName: "سمر الوادي", toPhone: "0799001005", toAddress: "جبل عمان", toZoneId: circle3Zone.id,
      priority: "urgent" as const, status: "pending" as const,
      trackingToken: generateTrackingToken(),
    },
    {
      orderId: "YW-2026-0006", fromBusiness: "كافيه ريترو", fromAddress: "شارع الرابية", fromZoneId: rabieZone.id,
      toCustomerName: "باسم الكردي", toPhone: "0799001006", toAddress: "أم أذينة", toZoneId: insertedZones.find(z => z.nameEn === "Um Uthaina")!.id,
      priority: "normal" as const, status: "delivered" as const, driverId: drivers[3].id,
      trackingToken: generateTrackingToken(), assignedAt: new Date(Date.now() - 5 * 3600000),
      pickedAt: new Date(Date.now() - 4 * 3600000), deliveredAt: new Date(Date.now() - 3 * 3600000),
    },
    {
      orderId: "YW-2026-0007", fromBusiness: "عطارة البركة", fromAddress: "وسط البلد", fromZoneId: downtownZone.id,
      toCustomerName: "منى عيسى", toPhone: "0799001007", toAddress: "شفا بدران", toZoneId: insertedZones.find(z => z.nameEn === "Shafa Badran")!.id,
      priority: "normal" as const, status: "assigned" as const, driverId: drivers[4].id,
      trackingToken: generateTrackingToken(), assignedAt: new Date(Date.now() - 15 * 60000),
    },
    {
      orderId: "YW-2026-0008", fromBusiness: "هارد ستور", fromAddress: "شارع خلدا", fromZoneId: khildaZone.id,
      toCustomerName: "زياد رأفت", toPhone: "0799001008", toAddress: "طبربور", toZoneId: insertedZones.find(z => z.nameEn === "Tabarbour")!.id,
      priority: "urgent" as const, status: "delivered" as const, driverId: drivers[5].id,
      trackingToken: generateTrackingToken(), assignedAt: new Date(Date.now() - 6 * 3600000),
      pickedAt: new Date(Date.now() - 5.5 * 3600000), deliveredAt: new Date(Date.now() - 5 * 3600000),
    },
    {
      orderId: "YW-2026-0009", fromBusiness: "متجر الأناقة", fromAddress: "دوار عبدون", fromZoneId: abdounZone.id,
      toCustomerName: "ريم حمدان", toPhone: "0799001009", toAddress: "شارع الشميساني", toZoneId: shmaisaniZone.id,
      priority: "normal" as const, status: "pending" as const,
      trackingToken: generateTrackingToken(),
    },
    {
      orderId: "YW-2026-0010", fromBusiness: "برجر بيت", fromAddress: "الصويفية مول", fromZoneId: sweifiehZone.id,
      toCustomerName: "كريم ناصر", toPhone: "0799001010", toAddress: "مرج الحمام", toZoneId: insertedZones.find(z => z.nameEn === "Marj Al-Hamam")!.id,
      priority: "urgent" as const, status: "delivered" as const, driverId: drivers[6].id,
      trackingToken: generateTrackingToken(), assignedAt: new Date(Date.now() - 4 * 3600000),
      pickedAt: new Date(Date.now() - 3.5 * 3600000), deliveredAt: new Date(Date.now() - 2.5 * 3600000),
    },
  ];

  const insertedOrders = await db.insert(ordersTable).values(
    orderData.map(o => ({ ...o, notes: null }))
  ).returning();

  // Insert ratings for delivered orders
  const deliveredOrders = insertedOrders.filter(o => o.status === "delivered");
  const ratingsData = [
    { orderId: deliveredOrders[0].id, driverId: drivers[0].id, customerName: "ليلى منصور", stars: 5, comment: "ممتاز! وصل سريع جداً" },
    { orderId: deliveredOrders[1].id, driverId: drivers[3].id, customerName: "باسم الكردي", stars: 4, comment: "خدمة جيدة وسائق محترم" },
    { orderId: deliveredOrders[2].id, driverId: drivers[5].id, customerName: "زياد رأفت", stars: 5, comment: "أفضل سائق! شكراً" },
    { orderId: deliveredOrders[3].id, driverId: drivers[6].id, customerName: "كريم ناصر", stars: 3, comment: "تأخر قليلاً لكن الخدمة مقبولة" },
  ];

  await db.insert(ratingsTable).values(ratingsData);

  // Seed extra historical ratings for drivers
  const extraRatings = [
    { orderId: deliveredOrders[0].id, driverId: drivers[0].id, customerName: "عميل سابق", stars: 5, comment: "رائع" },
    { orderId: deliveredOrders[0].id, driverId: drivers[1].id, customerName: "عميل آخر", stars: 4, comment: "جيد" },
    { orderId: deliveredOrders[0].id, driverId: drivers[2].id, customerName: "عميل كريم", stars: 5, comment: "ممتاز دائماً" },
  ];
  // Note: we skip extra ratings to avoid FK conflicts in demo

  // Insert notifications
  await db.insert(notificationsTable).values([
    { userId: manager.id, message: "طلب جديد YW-2026-0004 من مكتبة الفكر", type: "order", isRead: false },
    { userId: manager.id, message: "طلب جديد YW-2026-0005 من مطبخ الستات - عاجل", type: "order", isRead: false },
    { userId: manager.id, message: "الطلب YW-2026-0001 تم توصيله بنجاح", type: "order", isRead: true },
    { userId: drivers[0].id, message: "تم تعيينك لطلب YW-2026-0001", type: "order", isRead: true },
    { userId: drivers[1].id, message: "تم تعيينك لطلب YW-2026-0002", type: "order", isRead: false },
    { userId: drivers[2].id, message: "تم تعيينك لطلب YW-2026-0003", type: "order", isRead: false },
    { userId: drivers[0].id, message: "حصلت على تقييم 5 نجوم من ليلى منصور", type: "rating", isRead: false },
  ]);

  logger.info("Database seeded successfully!");
}
