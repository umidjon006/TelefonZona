# TelefonZona Claude connector (MCP)

Holat sanasi: 2026-11-23. Server `/mcp` manzilida Model Context Protocol (Streamable HTTP)
beradi. Claude (claude.ai yoki Claude ilovasi) uni **custom connector** sifatida ulaydi:
do‘kon haqida savollarga javob beradi va (yozish ruxsati berilgan bo‘lsa) yozuvlarni kiritadi.
Masalan: Claude’ga yangi kelgan tovarlar ro‘yxati beriladi, u ularni platformaga o‘zi kiritadi.

## Ikki ruxsat darajasi (ulanishda inson tanlaydi)

Kirish sahifasida shaxs **o‘zi** tanlaydi (ilova so‘rab ololmaydi):

| Daraja | Nima qila oladi |
| --- | --- |
| **Faqat o‘qish** (standart tavsiya) | Savol-javob: savdo, qoldiq, qarz, kassa. Hech narsa o‘zgarmaydi |
| **O‘qish va yozish** | Yuqoridagi va `prepare_*` + `commit_change` orqali yozuv kiritish |

Yozish vositalari faqat yozish ruxsati berilgan ulanishga **ko‘rinadi**. Ruxsat shaxsning o‘z
huquqlaridan oshmaydi: Boybek ulasa, Claude ham faqat Boybek ekranida mumkin bo‘lganni qiladi.

## O‘qish vositalari

| Vosita | Kim uchun | Nima beradi |
| --- | --- | --- |
| `get_shop_summary` | Otabek: butun do‘kon; xodim: faqat o‘zi | Savdo, foyda, xarajat, ijara, kassa, qarz, ombor qiymati (Otabek); o‘z cheklari (xodim) |
| `search_products` | hamma | Mahsulot guruhlari, qoldiq, narx oralig‘i; qisqa nomlar (S23U). Tannarx faqat kirim ruxsati borlarga |
| `get_catalog_options` | hamma | Brend, kategoriya, material, sifat, egalarning aniq id va nomlari |
| `list_debts` | qarz ruxsati borlar | Ochiq qarzlar (`debt_id` bilan), telefon, muddat |
| `get_reminders` | hamma | Bugungi qarz eslatmalari, kirim topshiriqlari |
| `list_sales` | Otabek: hammasi + foyda; xodim: o‘ziniki | Cheklar |
| `list_receipt_tasks`, `who_entered_what` | Otabek: hammasi; xodim: o‘zi | Kirim topshiriqlari, kim nimani kiritgani |
| `get_cash_position`, `staff_performance` | faqat Otabek | Kassa, qarz, ijara, xodimlar natijasi |

## Yozish: har doim ikki bosqich

1. **`prepare_*`** hech narsa yozmaydi. Server so‘rovni qat’iy tekshiradi, o‘zgarishni
   **ma’lumotlar nusxasida sinab ko‘radi** (jami, tannarx, FIFO, qoldiq, kassa, qarz, foyda
   hisobini do‘konning o‘z kodi bajaradi) va aniq natijani qaytaradi: `summary` (oddiy o‘zbekcha
   satrlar), `effects`, `warnings`, `proposal_id` (15 daqiqa).
2. Claude bu natijani foydalanuvchiga ko‘rsatadi. Foydalanuvchi **aniq rozilik** bergach
   **`commit_change`** (`user_confirmed=true`) aynan shu o‘zgarishni yozadi.

| Vosita | Nima qiladi |
| --- | --- |
| `prepare_stock_receipt` | Yangi kelgan tovarlar ro‘yxati: mavjud mahsulotga (SKU) yoki yangisiga (g‘ilof guruhi / boshqa). Takror yaratmaydi, bor bo‘lsa yangi partiya qo‘shadi |
| `prepare_sale` | Sotuv (to‘liq yoki nasiya) |
| `prepare_debt_payment` | Qarz to‘lovi |
| `prepare_cash_entry` | Xarajat, qo‘shimcha daromad, kassaga pul qo‘shish, boshliqqa topshirish |
| `prepare_service_profit` | Xizmat sof foydasi |
| `prepare_price_change`, `prepare_low_stock_limit` | Narx oralig‘i, kam qoldiq chegarasi |
| `prepare_sale_return`, `prepare_dispose_stock` | Chekni to‘liq qaytarish, yaroqsiz tovarni hisobdan chiqarish |
| `prepare_rent`, `prepare_rent_payment` | Ijara belgilash (Otabek), ijara to‘lash |
| `prepare_day_close` | Kun yakuni sanog‘i (Otabek) |
| `prepare_receipt_task` | Xodimga kirim topshirish (Otabek) |

### Aniqlik uchun kafolatlar (testlar bilan tekshirilgan)

- **Claude hech qachon summani hisoblamaydi.** U niyatni beradi (qaysi mahsulot, nechta, tannarx,
  narx); jami, qoldiq, kassa, qarz, foyda serverda hisoblanadi.
- **Raqamlar qat’iy.** Faqat haqiqiy butun son qabul qilinadi. `"20.000"`, `20.5`, `"10"` (matn), manfiy yoki
  nol rad etiladi, chunki «20.000» yigirma ham, yigirma ming ham bo‘lishi mumkin. Claude’ga raqamni
  foydalanuvchi bilan aniqlab olish buyurilgan.
- **Noma’lum maydon jimgina o‘tkazib yuborilmaydi** (masalan `discount`, `price`): so‘rov rad etiladi.
- **Mahsulot faqat aniq SKU bilan topiladi**, taxminiy nom bilan emas. Brend, material, sifat, kategoriya
  katalogdagi aniq id bo‘lishi shart.
- **Takror yaratilmaydi:** bor guruh/mahsulotga yangi partiya qo‘shiladi; bir ro‘yxatda bir xil yangi
  mahsulot ikki marta bo‘lsa rad etiladi.
- **Hammasi yoki hech narsa.** Yetkazib berishning bitta qatori ham xato bo‘lsa, birorta qator ham yozilmaydi.
- **Hisob o‘zgarsa yozilmaydi.** Ko‘rsatilgan natija (qoldiq o‘zgarishi, kassa, qarz, tannarx, foyda) va
  commit paytidagi natija aynan bir xil bo‘lmasa, hech narsa saqlanmaydi va qayta tayyorlash kerak.
  Boshqa mahsulotlar bo‘yicha oradagi ishlar bunga xalaqit bermaydi.
- **Ikki marta yozilmaydi:** `commit_change` takrorlansa, birinchi natija qaytadi.
- **Yozuv hisob qoidalarini buzmaydi:** natija zaxira fayli tekshiruvidan o‘tmasa, saqlanmaydi.
- **Ogohlantirishlar:** tannarx avvalgi o‘rtacha tannarxdan 1,5 baravar ko‘p yoki yarmidan kam bo‘lsa, narx tannarxdan past bo‘lsa, soni
  juda katta bo‘lsa, kassa sanog‘ida farq bo‘lsa ko‘rsatiladi.
- **Iz qoladi:** har yozuv «Claude orqali» belgisi bilan tarixda ko‘rinadi (Sozlamalar → Amallar tarixi),
  har taklif va uning natijasi bazada saqlanadi.
- **Chegara:** soatiga 60 tadan ortiq yozuv, 50 tadan ortiq ochiq taklif mumkin emas.
- Xodim foyda va tannarxni ko‘rmaydi (taklif va natijada ham).

### Ataylab qo‘shilmaganlari

Mavjud yozuvni **tahrirlash yoki o‘chirish** (ilova ichida sabab bilan qilinadi), ruxsatlarni o‘zgartirish,
parollar, do‘kon sozlamalari, boshlang‘ich qoldiqlar, mahsulotni katalogdan olib tashlash, tasniflar va zaxira.
Bular xato bo‘lsa ziyoni katta, shuning uchun faqat ilovada, inson tasdig‘i bilan qoladi.

## Xavfsizlik

- Connector **kim ruxsat bergan bo‘lsa, o‘sha shaxs** nomidan ishlaydi; ruxsatlar (jumladan Otabek
  o‘chirgan huquqlar) har safar tekshiriladi.
- Kirish OAuth 2.1 bilan: shaxs odatdagi **parolini** TelefonZona sahifasiga yozadi (Claude’ga berilmaydi).
  PKCE (S256) majburiy; kod 10 daqiqa va faqat bir marta ishlaydi (noto‘g‘ri urinish ham uni yoqadi);
  access token 1 soat; refresh token 30 kun va har ishlatilganda almashadi, eskisi qayta kelsa shu ulanish
  butunlay o‘chiriladi. Parol urinishiga umumiy bloklash (5 urinish, 15 daqiqa) ishlaydi.
- Qaytish manzillari faqat Claude (`claude.ai`, `claude.com`) va `localhost`. `/mcp` boshqa saytlardagi
  brauzer sahifalaridan chaqirilmaydi. Tokenlar bazada faqat hash holida.
- **Uzish:** parolni almashtirish yoki Otabek tiklashi shu shaxsning barcha connectorlarini uzadi.
  Sozlamalar → **Claude ulanishlari**da har bir ulanish (kim, qaysi daraja, qachon) ko‘rinadi va «Uzish»
  bilan bekor qilinadi (Otabek hammasini, xodim o‘zinikini).
- Muhim: Claude’ga berilgan ma’lumot **Anthropic serverlariga** boradi. Faqat o‘zingiz va ishonchli
  do‘stingiz uchun ulang. Ma’lumotdagi matnlar (ism, izoh) buyruq emas, ma’lumot deb belgilangan.

### Ochiq qolgan xavf (muhim)

**Tasdiq Claude suhbatida beriladi.** Server `user_confirmed=true`ni va oldin ko‘rsatilgan natijani talab
qiladi, lekin Claude buni foydalanuvchi so‘ramasdan o‘zi yuborib yubora olmasligini server **bila olmaydi**.
Himoya: (1) Claude’ning o‘zi har bir yozuv vositasi chaqiruvida ruxsat so‘raydi. **«Always allow»
(doim ruxsat) ni TelefonZona yozish vositalari uchun yoqmang**; (2) har yozuv tarixda «Claude orqali»
bo‘lib ko‘rinadi; (3) xato yozuv ilovada sabab bilan tuzatiladi. Agar bundan qat’iyroq kerak bo‘lsa
(masalan, summa chegarasidan oshgan yozuv Otabek tasdig‘ini ilovada kutsin), buni alohida kelishib qo‘shamiz.

## Ulash (muhim shart: ommaviy HTTPS manzil)

Claude connectorni **Anthropic bulutidan** chaqiradi. Laptopdagi `127.0.0.1` yoki Wi-Fi manzilingiz ularga
ko‘rinmaydi. Demak kerak: serverga ommaviy `https://…` manzil (hosting yoki tunnel, `docs/BACKEND.md`
«Telefonda sinash»).

```sh
TZ_PUBLIC_URL=https://sizning-manzil.example TZ_COOKIE_SECURE=1 TZ_TRUST_PROXY=1 npm run server
```

Claude’da: Sozlamalar → Connectors → **Add custom connector** → `https://sizning-manzil.example/mcp`.
Claude kirish sahifasini ochadi: shaxs va parolni kiriting, **ruxsat darajasini tanlang**. Do‘stingiz o‘z
hisobida shu URL’ni qo‘shib, **o‘z shaxsi** bilan kiradi. Custom connector imkoniyati Claude tarifiga bog‘liq.

Birinchi marta yozishni **sinov ma’lumoti** bilan (yoki kichik, tekshirib bo‘ladigan kirim bilan) sinang.

## Hali yo‘q / sinalmagan

- **Haqiqiy claude.ai bilan ulanish bu yerda sinalmagan.** Protokol, OAuth, yozish oqimi va xavfsizlik
  haqiqiy HTTP orqali avtomatik testlarda va brauzerda tekshirilgan (ro‘yxatdan o‘tish, kirish, PKCE, token,
  yetkazib berish kiritish, ilovada ko‘rinishi, uzish), lekin ommaviy manzil bo‘lmagani uchun Claude’ning o‘zi
  bilan sinab bo‘lmadi. Birinchi ulanishda kichik moslash kerak bo‘lishi mumkin.
- Claude’ning o‘zi noto‘g‘ri mahsulotni tanlashi yoki foydalanuvchi aytmagan narsani tushunishi mumkin:
  shuning uchun natija har doim ko‘rsatiladi va tasdiqlanadi. Server faqat aniq SKU/id va to‘g‘ri raqamlarni qabul qiladi.
- Mavjud yozuvni tahrirlash/o‘chirish vositalari yo‘q (yuqoriga qarang).
- Ilovada «Claude takliflari» alohida ro‘yxati yo‘q; natija faqat tarixda va bazada.
- `TZ_PUBLIC_URL` o‘rnatilmasa manzil so‘rovdan olinadi (faqat sinash uchun); real joylashda majburiy deb hisoblang.
