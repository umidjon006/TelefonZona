# TelefonZona frontend

Telefon aksessuarlari do‘koni uchun o‘zbekcha savdo va ombor demosi. Node.js 22+ kerak;
qo‘shimcha paket o‘rnatilmaydi.

```sh
npm run dev
```

Brauzerda `http://localhost:4173` manzilini oching. Port band bo‘lsa `PORT=4174 npm run dev`.

## Otabek, Boybek va Asilbek

Boshliq — **Otabek**, ikkita sotuvchi — **Boybek** va **Asilbek**. Uchalasining ham o‘z
mahsulotlari bor. Sotuvchi, mahsulot egasi va pul tushgan hisob alohida saqlanadi. Ikkala
naqd kassa umumiy: kim sotganidan va tovar kimniki ekanidan qat’i nazar, pul tanlangan
kassaga tushadi. Karta / bank uchun avvalgi umumiy hisob ham saqlangan.

Avvalgi `aziz`, `sardor`, `jasur` ichki IDlari tarixiy yozuvlarni saqlash uchun o‘zgartirilmagan;
interfeysda ular mos ravishda Otabek, Boybek, Asilbek bo‘lib ko‘rinadi. Bu nomni to‘g‘rilash
eski mahsulotning egasini yoki miqdorini boshqa kishiga avtomatik o‘tkazmaydi.

**Boshqaruv** bo‘limida Otabek mahsulot turlari, g‘ilof materiallari, sifat guruhlari va brendlarni
qo‘shadi. To‘rt sifat guruhi bilan cheklanmaydi. Yangi qiymat darhol tegishli shakl va filtrda
chiqadi; «Boshqa mahsulot» shaklida yangi kategoriya, brend va sifat bilan tovar kiritiladi.

Boybek va Asilbekning sotuv, nasiya, narxdan tashqari savdo, qoldiq ko‘rish, mahsulot qo‘shish,
kirim, narx, kirim-chiqim, qarz, qaytarish, nuqson va o‘z yozuvini tuzatish ruxsatlari alohida
sozlanadi. Mahsulot qo‘shish yoqilsa, kirim huquqi ham yoqiladi. Standart holatda katalog va
kirimni faqat Otabek o‘zgartiradi. Umumiy hisobotlar, foyda, xodimlar statistikasi, boshqaruv,
zaxira va kun yakuni delegatsiya qilinmaydi — faqat Otabekka tegishli. Sotuvchi o‘z cheklarini
ko‘radi. Ruxsat tekshiruvi navigatsiyada ham, amal bajaruvchi funksiyalarda ham qo‘llangan.
Bu hali frontend namoyishi; haqiqiy login va server tekshiruvlari ulanmaguncha ma’lumotni
begona foydalanuvchidan himoyalangan deb bo‘lmaydi.

Savdo katalogida **Mahsulot egasi** filtri bor. Savatda egani almashtirish aynan shu model,
tur va sifatdagi boshqa egaga tegishli mahsulot guruhiga o‘tadi. Mos guruh / qoldiq bo‘lmasa,
egani soxta almashtirishga ruxsat berilmaydi. Aralash savdoda har qatordagi egasi chekda
saqlanadi; bitta kassa butun to‘lovni oladi. Yakunlash oynasi egalarni yana ko‘rsatadi.

## Ishlatish tartibi

1. Boshliq **Sozlamalar → Boshlang‘ich qoldiqlar**da hisob boshlanishidan oldingi ikkala
   kassa, bank va xodimlarga qarzini yozadi. Avvaldan qolgan mijoz qarzlari **Qarzdorlar**da
   alohida kiritiladi; ular yangi savdo yoki daromad hisoblanmaydi.
2. **Mahsulotlar → G‘iloflarni tez kiritish**da brend, model, kim uchun, g‘ilof turi va egasi
   tanlanadi. Arzon / O‘rta / Pro / Premium qatorlariga soni, tannarx, eng kam va yuqori narx
   yoziladi. Bir guruhning rang-naqshlari birga sanaladi. Erkaklar / ayollar, Karbon / Silikon /
   Shaffof / Charm, turli sifatlar va egalarning qoldiqlari aralashtirilmaydi.
3. Sotuvchi **Yangi sotuv**da mahsulot guruhini topadi. Samsung S / A / Note / Boshqa seriyalari
   va qidiruv bir sahifada ishlaydi. `S23+` = `S23 Plus`, `S23U` = `S23 Ultra`, `iPhone 15PM` =
   `iPhone 15 Pro Max`. SKU ham qidiruvda topiladi. Rasm, yorliq va skaner talab qilinmaydi.
4. Savatda kelishilgan narx yoziladi. **To‘lov va yakunlash**da 1-kassa, 2-kassa yoki bank
   tanlanadi. Kassalar sotuvchiga biriktirilmagan. Narx oralig‘idan tashqarida, jumladan tekinga
   sotishga izoh bilan ruxsat beriladi; boshliqqa platforma eslatmasi tushadi.
5. Nasiya bo‘lsa olingan summa, xaridor ismi, telefoni, muddati va izohi yoziladi. **Qarzdorlar**da
   istalgan sotuvchi bo‘lib-bo‘lib to‘lov oladi. Muddat kelgan qarz eslatmalarda ko‘rinadi.
6. **Kirim va chiqim** orqali xarajat, qo‘shimcha daromad, shaxsiy pul qo‘shish, topshirish,
   hisoblararo o‘tkazma va xodimga qarzni qaytarish izoh bilan yoziladi. Maosh va soliqlar shu
   yerda qo‘lda xarajat sifatida kiritiladi. Maosh foizi avtomatik hisoblanmaydi.
7. **Oylik ijara**ga har oy kelishilgan summa yoziladi. Ijara shu oyning foydasidan bir marta
   ayriladi; amaldagi ijara to‘lovi alohida kassa / bank harakati. Kun va haftaga taqsimlanmaydi.
8. Kun oxirida boshliq ikkala kassani sanaydi va har bir kassaga qoladigan qaytimni yozadi.
   Jami, farq va topshiriladigan pul oldindan ko‘rinadi. Faqat sanashni saqlash mumkin; pul
   amalda berilgan bo‘lsa, «Pulni berdim» tanlanadi va ikkala kassadan topshirish birga yoziladi.
   Farq yashirincha daromad / xarajatga yozilmaydi, alohida tekshirish uchun saqlanadi.

## Ruxsat va hisob qoidalari

Mahsulot yaratish, kirim va narx oralig‘ini standart holatda Otabek boshqaradi; tegishli amallarni xodimga berishi mumkin. Boshlang‘ich qoldiqlar faqat Otabek uchun.
Xodimga umumiy foyda hisoboti ko‘rsatilmaydi. Kirim / mahsulot qo‘shish ruxsati berilsa, shu shakllarda tannarx kiritiladi. Boshliq har sotuvchining dona, savdo summasi,
sotilgan tovar tannarxi va keltirgan yalpi foydasini, shuningdek mahsulot egalari hisobotini ko‘radi.
Sotuvchi va mahsulot egasi alohida saqlanadi. Uchala ega o‘rtasida pul taqsimlash qoidasi hali
kelishilmagan; avtomatik ulush yoki hisob-kitob kiritilmagan.

- FIFO: har partiyaning tannarxi saqlanadi; sotuvda avvalgi partiya ishlatiladi.
- Nasiya: to‘liq savdo summasi va tannarx sotuv vaqtida hisoblanadi. Keyingi qarz to‘lovi
  kassa / bankni oshiradi, qarzni kamaytiradi; daromadga qayta qo‘shilmaydi.
- Xodim o‘z pulidan xarajat qilsa, xarajat bir marta yoziladi va do‘konning unga qarzi paydo
  bo‘ladi. Qaytarib berish ikkinchi xarajat emas. Kassaga shaxsiy pul qo‘shish ham daromad emas.
- Chekni istalgan sotuvchi sabab bilan to‘liq qaytaradi. Olingan pul qaytariladi, ochiq nasiya
  bekor qilinadi, aynan sarflangan partiyalar tiklanadi. Qaytarish o‘z sanasida hisobotga tushadi.
  Almashtirish: avval chekni qaytarish, keyin yangi sotuv. Qisman chek qaytarish hali yo‘q.
- Nuqson: yaroqsiz tovar FIFO tannarxi bilan bir marta zararga chiqariladi. Tuzatiladigan
  mahsulotning ta’mir xarajati yoziladi; keyin savdoda arzonroq narx sabab bilan qo‘yiladi.
- Sof natija = savdo − sotilgan tovar tannarxi + qo‘shimcha daromad − kiritilgan xarajatlar −
  yaroqsiz tovar zarari − tegishli oylik ijara. Kiritilmagan maosh / soliq hisobga olinmaydi.

Hisobot chegaralari **Asia/Tashkent**da: kun 07:00; hafta yakshanba 23:00; oy 1-sana 07:00;
yil 31-dekabr 23:00. Davr yangilanishi hech qanday yozuvni o‘chirmaydi. Umumiy hisob, ombor,
pul va qarz qoldiqlari davom etadi. Kunlik / haftalik natijada «ijara ayrilmagan» deb yoziladi.

## Xato pul yozuvini tuzatish

**Kirim va chiqim → Tafsilot → Xato yozuvni bekor qilish** orqali sabab yoziladi.
Xodim o‘z yozuvini, boshliq esa xodim yozuvini ham bekor qiladi. Asl yozuv tarixda qoladi;
qarama-qarshi ta’sirli tuzatish hozirgi sanada qayd etiladi. Oldingi kun hisoboti o‘zgarmaydi.
Keyin kerak bo‘lsa to‘g‘ri summa yoki hisob bilan yangi yozuv kiritiladi.

Xarajat / daromad, o‘tkazma, topshirish, shaxsiy pul, xodimga qaytarish, nasiya to‘lovi va ijara
to‘lovi tuzatiladi. Pul bilan birga tegishli qarz qoldig‘i ham yangilanadi. Xodimga xarajati
qaytarib bo‘lingan bo‘lsa, avval o‘sha qaytarilgan to‘lovni tekshirish kerak; unga qarz manfiyga
aylanmaydi. Sotuvni chek orqali qaytarish kerak. Cheki allaqachon qaytarilgan qarz to‘lovi
alohida bekor qilinmaydi. Eski namunadagi alohida tovar kirimlari bu usul bilan bekor qilinmaydi.

## Zaxiradan tiklash

Boshliq **Sozlamalar → Zaxiradan tiklash** orqali TelefonZona JSON faylini tanlaydi (8 MB gacha).
Fayl versiyasi, raqamlar, partiyalar, takrorlangan ID, qarz to‘lovlari va havolalar tekshiriladi.
Mahsulotlar, cheklar, qarz va pul qoldiqlari «Hozir / Faylda» jadvalida solishtiriladi.
Tiklash faqat shu oynadagi tasdiqlash tugmasi bosilganda amalga oshadi.

Tiklash fayldagi ma’lumotni ushbu brauzerdagi joriy ma’lumot o‘rniga qo‘yadi. Joriy nusxa avval
`telefonzona-before-restore` kalitida saqlanadi va **Tiklashdan oldingi nusxani yuklash** tugmasi
bilan olinadi. Asosiy ma’lumot `telefonzona-v1` kalitida qoladi. Oldingi nusxa har tiklashda
almashtiriladi; uzoq muddatli zaxira sifatida JSON fayllarini alohida saqlang. Tekshiruv yoki
saqlash xatosida joriy hisob almashtirilmaydi. Fayl ko‘rib chiqilayotganda boshqa brauzer oynasi
hisobni o‘zgartirsa, tiklash to‘xtatiladi va qayta solishtirish talab qilinadi.

## Saqlash va hozirgi cheklovlar

Bu **frontend namuna**, ishga tayyor serverli hisob tizimi emas. Ma’lumotlar `telefonzona-v1`
localStorage kalitida shu brauzerda saqlanadi. Saqlash xatosi bo‘lsa, yangi amal qabul qilinmaydi.
Oldingi cheklar, ombor partiyalari va narxlar saqlanib, yangi maydonlar qo‘shiladi. Oldingi
ijara to‘lovlari ijara jadvaliga takror ayrilmasdan ko‘chiriladi. Yangi namunalardagi sifat va
guruhlar sun’iy misol; avval kiritilgan mahsulotlar avtomatik tasniflanmaydi yoki birlashtirilmaydi.

Sayt bir marta muvaffaqiyatli ochilgach, service worker interfeysni offline ochish uchun
keshlaydi. Yangi amallarda noyob ID va mahalliy saqlash holati bor. **Serverga yuborish,
ikki qurilma sinxronlashuvi, serverdagi takrorlarni aniqlash / konfliktlarni hal qilish,
haqiqiy login va telefonga push hali ulanmagan.** Rol almashtirish taqdimot uchun.
Brauzer xotirasi tozalansa ma’lumot yo‘qolishi mumkin; boshliq JSON zaxirasini yuklab oladi.
Kiritilmagan savdoni frontend o‘zi aniqlay olmaydi.

## Tekshirish va build

```sh
npm run check
npm test
npm run build
npm run preview
```

`dist/` statik hosting uchun fayllarni, jumladan offline interfeys keshini saqlaydi.

- `src/app.js`: sahifalar, shakllar va amallar.
- `src/access.js`: Otabek, Boybek, Asilbek profillari va amal / sahifa ruxsatlari.
- `src/admin.js`: boshliq sozlaydigan mahsulot tasniflari va xodim huquqlari.
- `src/ownership.js`: savatda haqiqiy mahsulot egasi va qoldig‘ini tanlash.
- `src/business.js`: nasiya, pul harakati, izohli tuzatish, ijara, kassa yakuni va hisobot.
- `src/backup.js`: zaxira faylini tekshirish, eski formatni moslash va solishtirish raqamlari.
- `src/model.js`: namuna ma’lumotlari, FIFO sotuv / kirim / qaytarish.
- `src/inventory-entry.js`: guruhlab kirim va boshliqning narx boshqaruvi.
- `src/catalog.js`: brend, seriya va model qisqartmalari.
- `sw.js`: faqat frontend fayllarining offline keshi.
- `tests/`: hisoblash, ruxsatlar, atomarlik va davr chegaralari tekshiruvlari.
