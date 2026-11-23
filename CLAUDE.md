# TelefonZona bilan ishlash

Avval [to‘liq topshirish hujjatini](docs/CLAUDE_HANDOFF.md) o‘qing. Unda foydalanuvchi
bilan kelishilgan biznes qoidalari, amaldagi kod, cheklovlar, sinovlar va davom
ettirish tartibi bor. Hujjat 2026-11-23 holatiga tayyorlangan.

## Asosiy kontekst

- Foydalanuvchi Umidjon bu platformani do‘sti Otabekning telefon aksessuarlari
  do‘koni uchun tayyorlayapti. Interfeys o‘zbekcha, asosan telefonda ishlatiladi.
- Otabek boshliq va sotuvchi. Boybek va Asilbek uning ikki xodimi. Uchalasining
  ham o‘z mahsulotlari bor. Sotuvchi bilan mahsulot egasi boshqa-boshqa tushuncha.
- Bitta umumiy kassa bor. Eski ikki kassa talabini qaytarmang. Naqd/karta/o‘tkazma
  to‘lov turlari saqlanadi, amaldagi pul hisobi esa `cash`.
- Bitta platforma, umumiy ish maydoni va uchta profil mavjud. Boshqaruv va umumiy
  moliyaviy hisobotlar Otabek roliga ajratilgan.
- Ilova ikki rejimda ishlaydi ([docs/BACKEND.md](docs/BACKEND.md)). `npm run server`
  bergan sahifada **server rejimi**: xodim+parol bilan kirish, SQLite, server ruxsatlari,
  qurilmalararo sinxronlash (so‘rov orqali), eslatmalar, kirim topshiriqlari. Statik
  hosting va `npm run dev`da **mahalliy demo rejimi** (rol tanlagichi login emas,
  `telefonzona-v2`). Ikkalasi `src/commands.js` buyruqlarini ishlatadi: yangi amal
  qo‘shilsa shu yerga qo‘shing, `app.js`da `act()` bilan chaqiring. Oflayn navbat va
  push yo‘q; server hali joylanmagan (HTTPS, tashqi zaxira kerak).
- Claude connector (MCP) `/mcp`da; OAuth bilan kirish shaxsning o‘z ruxsati doirasida ishlaydi
  ([docs/MCP.md](docs/MCP.md)). Yozish faqat ikki bosqichda: `prepare_*` (nusxada sinab, aniq natija) va
  tasdiqdan keyin `commit_change`. Yangi yozish vositasi shu qolipga amal qilsin (qat’iy raqamlar, noma’lum
  maydon rad etiladi, hammasi-yoki-hech narsa, hisob o‘zgarsa yozilmaydi) va testlarsiz qo‘shilmasin.
- Ishlayotgan frontendni foydalanuvchining yangi topshirig‘isiz boshqa frameworkda
  boshidan yozmang. Hozir oddiy JavaScript ES modules, CSS, Node.js 22+, tashqi
  paketlarga bog‘liqliksiz ishlaydi.

## Saqlanishi kerak bo‘lgan qoidalar

1. Ichki IDlar: `aziz` = Otabek, `sardor` = Boybek, `jasur` = Asilbek.
   Display nomni almashtirish tarixiy ID, egalik yoki savdolarni almashtirmaydi.
2. Mavjud ma’lumotlarni saqlang. Asosiy localStorage kaliti `telefonzona-v2`.
   Uni o‘zgartirish yoki real yozuvlarni demo bilan almashtirish mumkin emas.
3. Yangi hisob bo‘sh ombor va nol summalar bilan ochiladi. Sun’iy ma’lumot faqat
   testlarda yoki alohida mahalliy sinov originida bo‘lsin.
4. Eski tashqi JSONni import qilish foydalanuvchi tomonidan bekor qilingan.
   Shaxsiy backup, mijoz telefonlari va do‘kon ma’lumotlarini GitHub’ga qo‘shmang.
5. Mahsulot tannarxi, sotish narx oralig‘i va haqiqiy sotilgan narx alohida.
   Savdolashish bor. Chegaradan tashqari va tekinga berish sabab bilan yoziladi.
6. G‘iloflar model + kim uchun + material + sifat + egasi bo‘yicha guruhlanadi.
   Har bir rang/naqsh uchun majburiy rasm, QR yorliq yoki skaner talab qilmang.
7. Hisob butun UZSda, vaqt `Asia/Tashkent`. Mahsulot tannarxi FIFO partiyalaridan.
   Qarz to‘lovi qayta daromad emas; kassa qoldig‘i sof foyda emas.
8. Qo‘shimcha xizmatga faqat tayyor sof foyda kiritiladi. U umumiy va bajargan
   xodim foydasiga qo‘shiladi. Hozir bu yozuv kassaga yana tushum yozmaydi.
9. O‘chirishda oqibatini ko‘rsatgan `O‘chirilsinmi?` oynasi va Ha/Yo‘q bo‘lsin.
   Bog‘langan moliyaviy yozuvlarda tarixni buzmasdan bekor qilish/tuzatish kerak.
10. Maosh foizi, uchta mahsulot egasi o‘rtasida pul taqsimoti, bank integratsiyasi
    va boshqa kelishilmagan qoidalarni o‘zingizdan o‘ylab kiritmang.
11. Telefon ko‘rinishini saqlang: pastki menyu, katta tugmalar, kartali ro‘yxatlar,
    mobil shakllar. To‘rtta mavjud mavzuni saqlang.
12. Foydalanuvchining doimiy topshirig‘i: tugallangan o‘zgarishlarni GitHub’ga
    yuklab boring. Begona o‘zgarishlarni qo‘shmang; force-push qilmang.

## Ishga tushirish va tekshirish

```sh
npm run dev
# http://localhost:4173
# Port band bo‘lsa: PORT=4174 npm run dev

npm run check
npm test
npm run build
npm run preview

npm run server:passwd -- aziz   # parol o‘rnatish (sardor, jasur ham)
npm run server                  # http://127.0.0.1:4180, API + sahifa
```

Yangi frontend modul qo‘shilsa `scripts/frontend-files.mjs` allowlisti (dev server
ham, API server ham shundan foydalanadi), `sw.js` shell ro‘yxati va zarur bo‘lsa `package.json` syntax checklarini ham yangilang.
`src/model.js`dagi eski `metrics`/`expectedCash` emas, yangi UI moliyasi uchun
`businessReport`/`accountBalances` ishlatiladi. Batafsil farq topshirish hujjatida.

- GitHub: https://github.com/umidjon006/TelefonZona
- Demo: https://telefonzona-demo-03c5ad5.umidjonanvarov230.chatgpt.site
- Hosting identifikatori `.openai/hosting.json`da. Mavjud saytni boshqa yangi
  sayt bilan almashtirmang. GitHub’ga push qilishning o‘zi demo deployi emas.

Yangi topshiriq bo‘lmasa, avval kontekstni o‘qib tayyor va qolgan ishlarni qisqa
ayting. Hujjatdagi kelajak takliflarini avtomatik bajarishga ruxsat deb olmang.
