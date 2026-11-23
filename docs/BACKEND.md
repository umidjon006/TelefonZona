# TelefonZona backend (1-bosqich, laptopda sinash uchun)

Holat sanasi: 2026-11-23. Bu bosqich **tayyor serverni** beradi, lekin **frontend
(`src/app.js`) hali unga ulanmagan**: ilova hozircha o‘z `localStorage`ida ishlayapti.
Ulanish alohida keyingi qadam. Serverga joylashdan oldin shu hujjatdagi
«Hali yo‘q» bo‘limini o‘qing.

## Nima uchun shunday qurilgan

- Tashqi paket yo‘q: Node.js `http`, `crypto` va o‘rnatilgan `node:sqlite`. Node 22.13+ talab qilinadi; faqat Node 24.22 bilan sinalgan, serverda ham shu versiyani qo‘ying.
- Serverda **frontend bilan bir xil domen modullari** ishlaydi (`src/business.js`,
  `src/management.js`, ...). FIFO, nasiya, qaytarish, ijara va boshqa qoidalar ikki
  joyda alohida yozilmagan; server ularni qayta ishlatadi va ruxsatlarni o‘zi tekshiradi.
- Har o‘zgarish bitta nomli **buyruq** (`POST /api/commands`). Kim bajarayotganini
  so‘rov emas, **kirgan sessiya** belgilaydi. Soxta `actor` yuborib bo‘lmaydi.
- Buyruq bitta tranzaksiyada, eng oxirgi saqlangan holatga qo‘llanadi. Xato bo‘lsa
  hech narsa saqlanmaydi. Natija zaxira fayli tekshiruvidan (`readBackup`) ham
  o‘tmasa, buyruq rad etiladi (hisob mosligi buzilmaydi).
- Ikki qurilma bir vaqtda oxirgi tovarni sotsa, birinchisi o‘tadi, ikkinchisi
  «qoldiq yetarli emas» xatosini oladi. Jim ustiga yozish yo‘q.
- `opId` (UUID) bilan qayta yuborilgan buyruq ikki marta bajarilmaydi, birinchi
  javob qaytariladi. Internet uzilib qayta urinish uchun tayyorlangan.

## Ishga tushirish (laptopda)

```sh
npm run server:passwd -- aziz      # Otabek paroli (yashirin kiritiladi)
npm run server:passwd -- sardor    # Boybek
npm run server:passwd -- jasur     # Asilbek
npm run server                     # http://127.0.0.1:4180
```

- Standart parol yo‘q. Parol o‘rnatilmagan shaxs kira olmaydi.
- Parol 8–128 belgi. U buyruq argumentiga yozilmaydi.
- Telefondan shu Wi-Fi orqali sinash: `HOST=0.0.0.0 npm run server`. HTTPS bo‘lmasa
  bu faqat uy/do‘kon tarmog‘ida, vaqtincha.
- Server sahifaning o‘zini ham beradi (`TZ_STATIC=dist` bo‘lsa `dist/` dan).

Foydali buyruqlar: `npm run server:people` (kimda parol bor), `npm run server:backup`
(zaxira), `npm run server:check` (baza butunligi).

## Sozlamalar (muhit o‘zgaruvchilari)

| O‘zgaruvchi | Standart | Ma’nosi |
| --- | --- | --- |
| `PORT` | 4180 | Server porti |
| `HOST` | 127.0.0.1 | Tinglash manzili |
| `TZ_DATA_DIR` | `data/private` | Baza va zaxiralar papkasi (git e’tiborsiz qoldiradi) |
| `TZ_DB` | `<data>/telefonzona.db` | Baza fayli |
| `TZ_BACKUP_HOURS` | 24 | Avtomatik zaxira oralig‘i (0 = o‘chiq) |
| `TZ_BACKUP_KEEP` | 14 | Nechta zaxira saqlanadi |
| `TZ_STATIC` | (manba) | `dist` bo‘lsa qurilgan frontend beriladi |
| `TZ_COOKIE_SECURE` | 0 | HTTPS orqasida `1` qiling |
| `TZ_TRUST_PROXY` | 0 | Reverse proxy ortida `1` (IP va `X-Forwarded-Proto` uchun) |
| `TZ_ALLOWED_ORIGINS` | bo‘sh | Boshqa origin (masalan, o‘rnatilgan ilova) uchun vergul bilan |

## Xavfsizlik

- Parollar `scrypt` bilan (tuz bilan) saqlanadi. 5 ta xato urinishdan keyin shu
  shaxs 15 daqiqaga bloklanadi; IP bo‘yicha ham chegara bor. Noma’lum shaxs va parolsiz
  hisob bir xil vaqt va bir xil xato oladi.
- Sessiya: tasodifiy 256 bit token, bazada faqat hash. Cookie `HttpOnly`,
  `SameSite=Strict` (HTTPS bo‘lsa `Secure`). 30 kun, har soat uzayadi, har shaxsga 10 qurilma.
- Parol almashtirilsa yoki Otabek tiklasa, boshqa qurilmalar chiqib ketadi.
- Yozuvchi so‘rovlar `X-TZ-Client: web` sarlavhasini va mos `Origin`ni talab qiladi.
- Buyruq nomlari ro‘yxati qat’iy. `__proto__`, `constructor`, `prototype` kalitlari
  va haddan katta so‘rovlar rad etiladi. Tanani 1 MB bilan cheklaydi.
- Brauzerga faqat frontend fayllari beriladi (`scripts/frontend-files.mjs`). Server
  kodi, testlar, baza, `.git` 404. Sahifada qat’iy CSP.
- **Xodimga faqat o‘ziga tegishli ma’lumot yuboriladi.** Boshqa odamning cheklari, xarajat,
  ijara, kassa sanog‘i, audit, boshlang‘ich qoldiq, boshliq xabarlari va chek tannarxi
  `GET /api/state` javobida bo‘lmaydi (`server/view.js`, testlangan).

## API

Hammasi `application/json`. Kirishdan tashqari barcha yo‘llar sessiya cookie talab qiladi.

| Yo‘l | Vazifasi |
| --- | --- |
| `GET /api/health` | Server tirikligi, hisob versiyasi |
| `GET /api/people` | Kirish ekrani uchun ismlar (faqat ism) |
| `POST /api/login` / `logout` | Kirish / chiqish |
| `GET /api/me` | Kim kirgan, ruxsatlari |
| `GET /api/state?since=V` | O‘z ko‘rinishidagi ma’lumot va eslatmalar; versiya o‘zgarmagan bo‘lsa `{unchanged:true}` |
| `GET /api/reminders` | Eslatmalar |
| `POST /api/commands` | `{opId, command, args}` — o‘zgartirish |
| `POST /api/password` | O‘z parolini almashtirish |
| `POST /api/admin/password` | Otabek: xodim parolini tiklash |
| `GET /api/export` | Otabek: to‘liq JSON nusxa |

Buyruqlar ro‘yxati `server/commands.js`da (savdo, qarz, kassa, mahsulot, kirim,
xizmat, boshqaruv va `intake.*`). Har biri `boss:true` belgisi va domen ichidagi
tekshiruv bilan himoyalangan.

## Eslatmalar (SMS kerak emas)

Qarz muddati kelganda eslatma **har so‘rovda hisoblanadi** (rejalovchi kerak emas) va
Otabek hamda ikkala xodimga ham chiqadi:

- «Bugun Ali qarzini berishi kerak · 50 000 so‘m» (muddat bugun)
- «Ali qarzini 3 kun kechiktirdi · 50 000 so‘m» (muddat o‘tgan)

Telefon raqami va «to‘lov olish» tugmasi faqat qarz ruxsati borlarga. To‘langach
eslatma o‘zi yo‘qoladi. SMS uchun operator shlyuzi (pullik) kerak bo‘lardi; hozir yo‘q.
Ilova yopiq bo‘lganda telefonga xabar (push) hali **yo‘q**; pastga qarang.

## Kirim topshiriqlari (ikki xodim bir mahsulotni kiritmasin)

Otabek yangi kelgan tovarni xodimga topshiradi: `intake.create` (xodim, qatorlar:
nima, necha dona, ixtiyoriy mavjud mahsulot). Xodim `intake.receive` bilan haqiqiy
kirimni yozadi (mavjud mahsulotga partiya, yangi mahsulot yoki g‘ilof guruhlari).

- Topshirilgan mahsulotga boshqa xodim kirim qila olmaydi (Otabek mumkin).
- Har kirimda kim kiritgani saqlanadi (`purchase.actor`, `intakeId`);
  mahsulotda `createdBy`. `entriesByWorker` xodimlar kesimidagi ro‘yxatni beradi.
- Aynan bir xil oddiy mahsulotni ikkinchi marta yaratish rad etiladi («ro‘yxatda bor»);
  g‘iloflar esa avvalgidek mavjud guruhga qo‘shiladi.
- Topshiriq qayta tayinlanadi (`intake.reassign`) yoki bekor qilinadi (`intake.cancel`);
  qabul qilingan tovar omborda qoladi. Pul qoidasi qo‘shilmagan: kirim avvalgi
  kirim funksiyalari orqali o‘tadi.
- Xodim ekranida: o‘z topshiriqlari va shaxsiy xabarlar (`inbox`).

Kelishilmagan: xodim faqat topshirilgan tovarni kirimlashi kerakmi, yoki
topshiriqsiz ham kirita oladimi. Hozir topshiriqsiz erkin (faqat topshirilgani qulflanadi).

## Android va iOS

Hozir ilova o‘rnatiladigan **PWA**: `manifest.webmanifest`, ikonkalar (`icons/`,
paketsiz `scripts/make-icons.mjs` bilan chiziladi), iOS meta teglari, service worker.

- Android (Chrome): «Ekranga qo‘shish / O‘rnatish». iOS (Safari): «Bosh ekranga».
- Do‘kon do‘konlariga (Google Play / App Store) chiqarish alohida bosqich: iOS uchun
  Mac, Xcode va pullik Apple Developer hisobi kerak. 3 kishilik do‘kon uchun PWA yetarli bo‘lishi mumkin.
- PWA uchun HTTPS shart (localhost bundan mustasno), shuning uchun real o‘rnatish serverga
  joylangandan keyin sinaladi.

## Hali yo‘q (serverga joylashdan oldin shu qoladi)

1. **Frontend serverga ulanmagan.** `mutate()` `localStorage`ga yozadi. Ulash:
   kirish ekrani, `mutate` o‘rniga buyruq yuborish, `GET /api/state` bilan yangilash
   (polling), kirim topshiriqlari va eslatmalar ekranlari. Rol tanlagich olib tashlanadi.
2. Eski `localStorage` ma’lumotlarini serverga ko‘chirish yo‘li (agar Otabek brauzerida
   haqiqiy yozuvlar bo‘lsa) kelishilishi kerak. Avtomatik ko‘chirilmaydi.
3. **HTTPS** serverning o‘zida yo‘q. Joylashda reverse proxy (Caddy/nginx) kerak,
   `TZ_TRUST_PROXY=1`, `TZ_COOKIE_SECURE=1`.
4. Telefon **push** (Web Push) yo‘q. iOS 16.4+ da faqat bosh ekranga qo‘shilgan PWAga.
5. Oflayn navbat yo‘q (server tomoni `opId` bilan tayyor).
6. Zaxira shu diskda. Boshqa joyga (boshqa qurilma / bulut) nusxalash kerak; fayllarda
   parol hashlari ham bor. Tiklash: serverni to‘xtating, `telefonzona.db-wal` va `telefonzona.db-shm` fayllarini o‘chirib, zaxira faylini `telefonzona.db` o‘rniga qo‘ying (tiklash hali sinalmagan, birinchi marta nusxada sinab ko‘ring).
7. Bitta jarayon, bitta SQLite fayl. Bir nechta nusxa ishga tushirmang. Holat bitta
   JSON hujjat sifatida saqlanadi; do‘kon hajmida yetarli, juda katta tarixda
   jadvallarga bo‘lish kerak bo‘ladi.
8. Mustaqil xavfsizlik auditi o‘tkazilmagan; ikki faktorli kirish va qurilmalar ro‘yxati yo‘q.

## Testlar

`npm test` — 100+ test, ularning ichida haqiqiy HTTP orqali kirish, bloklash,
ruxsat, ma’lumot yashirinligi, qayta yuborish, kirim qulfi, qarz eslatmasi,
zaxira va butun kunlik oqim. Testlar xotiradagi baza va sun’iy yozuvlarni ishlatadi.
