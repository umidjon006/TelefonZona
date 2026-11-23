# TelefonZona loyihasini Claude Code ga topshirish

Bu hujjat Umidjon bilan loyiha bo‘yicha kelishilgan talablarni, ularning sababini,
hozirgi kodning ishlashini va hali ochiq masalalarni bir joyga yig‘adi. Claude Code
loyihani boshidan so‘rab chiqmasdan davom ettirishi uchun yozilgan. Kelajak haqidagi
takliflar tayyor imkoniyat yoki ularni darhol amalga oshirish topshirig‘i emas.

**Holat sanasi:** 2026-11-23, Asia/Tashkent.

**Hujjatdan oldingi oxirgi funksional commit:**
`cfd201cc2e690f50e7670d0cf057e302152e3f1c`.
Hujjat va README tuzatishlari keyingi alohida commitda bo‘lishi mumkin.

| Manba | Manzil |
| --- | --- |
| Mahalliy loyiha | `/home/umidjon/TelefonZona` |
| GitHub | https://github.com/umidjon006/TelefonZona |
| Hozirgi ochiq demo | https://telefonzona-demo-03c5ad5.umidjonanvarov230.chatgpt.site |
| Git remote | `git@github.com:umidjon006/TelefonZona.git` |
| Boshlang‘ich eski namuna | https://dukon-flow-demo-umid-1022.greengnat1024.chatgpt.site |

Eski namuna tarixiy dizayn manbasi. Hozirgi kod, yangi talablar va hozirgi demo
ustuvor; eski havolaga qarab yakuniy biznes qoidalarini orqaga qaytarmang.

## 1. Claude avval nimani o‘qishi kerak

1. `CLAUDE.md` va ushbu hujjat.
2. `src/access.js`, `src/model.js`, `src/business.js`, `src/management.js`.
3. `src/admin.js`, `src/inventory-entry.js`, `src/backup.js`, `src/ownership.js`.
4. `src/app.js`, `src/catalog.js`, `src/responsive.js`, CSS va mavzular.
5. Tegishli `tests/*.test.mjs`, `package.json`, hosting manifesti va skriptlar.

Qoidalar farq qilsa foydalanuvchining eng yangi aniq topshirig‘i ustuvor.
Hujjat ma’lum holatni qayd etadi; keyingi kod o‘zgarishidan keyin uning tegishli
qismini ham yangilash kerak. Noma’lum narsalar quyida alohida belgilangan.

## 2. Do‘kon va muammoning sababi

Umidjon platformani do‘sti **Otabek**ning telefon aksessuarlari do‘koni uchun
tayyorlayapti. Otabekning ikki xodimi bor: **Boybek** va **Asilbek**. Otabekning
o‘zi ham savdo qiladi va telefon ta’mirlaydi. Uchalasining o‘z mahsulotlari bor;
boshqa kishining mahsulotini ham sotishi mumkin. Mahsulotlar aralash joylarda va
alohida tokchalarda turadi. Bir xodimning alohida mahsulot tokchasi ham bor.

Do‘kon rasmlarida juda ko‘p g‘ilof, kabel, quvvatlagich, quloqchin va turli boshqa
aksessuarlar bor. Bir modelga mos g‘ilofning o‘zida ko‘p naqsh va narx darajasi
uchraydi. Har birini rasmga olib joylash va yuzlab rasmlar orasidan qidirish
foydalanuvchi uchun ortiqcha ish. Har biriga QR yorliq yopishtirish, printer va
skaner sotib olish ham hozir qabul qilinmagan.

Otabek hozir foydani taxminan: mahsulot, ishchi, ijara va soliqqa pul bergandan
keyin qancha qolganiga qarab biladi. Platformaning vazifasi kirim, chiqim,
savdo, tannarx, qarz va qoldiqni aniq yozib, shu noaniqlikni kamaytirish.

Asosiy savollar:

- Qaysi xodim qaysi egaga tegishli qaysi mahsulotni nechta va qanchaga sotdi?
- Haqiqatan qancha pul olindi, qancha qarz qoldi?
- Sotilgan mahsulotning tannarxi va foydasi qancha?
- Omborda kerakli model bormi, qaysi guruh kamaygan, nimani yana olish kerak?
- Kassadagi pul qayerdan keldi va nima uchun chiqdi?
- Har bir xodimning savdo va xizmatdan keltirgan natijasi qancha?

Tizimga umuman kiritilmagan yoki yolg‘on summa bilan kiritilgan savdoni frontend
mustaqil aniqlay olmaydi. Nazorat qayd etilgan amallar, qoldiq tekshiruvi, sanash
va boshliq ko‘radigan tarixga tayanadi. «100% o‘g‘irlikni to‘xtatadi» demang.

## 3. Oxirgi qarorlar va bekor qilingan eski takliflar

| Mavzu | Hozirgi kelishuv |
| --- | --- |
| Kassalar | **Bitta umumiy kassa.** Avvalgi 1-kassa va 2-kassa olib tashlangan. |
| Profillar | Otabek, Boybek, Asilbek. Umumiy ish maydoni shu platformaning bir qismi. |
| Mahsulot egasi | Uchalasining ham o‘z mahsuloti bor. Sotuvchidan alohida saqlanadi. |
| Ish qurilmasi | Asosan telefon. Planshet, laptop va monitor ham ishlaydi. |
| Mahsulot rasmlari | Majburiy emas. Katalogda brend belgisi va aniq nomlar. |
| QR va shtrixkod | Har bir mahsulotga majburiy yorliq/skaner jarayoni hozir yo‘q. |
| Naqshlar | Bir xil hisob guruhidagi rang-naqshlar birga sanaladi. |
| Maosh | Boshliq kun oxirida o‘zi kelishadi. Hozir avtomatik foiz hisoblanmaydi. |
| Kelajakdagi maosh foizi | Taklif sifatida aytilgan, miqdor va qoida kelishilmagan. |
| Ijara | Har oy kelishilgan summa qo‘lda kiritiladi; oylik foydadan ayriladi. |
| Qo‘shimcha xizmatlar | Faqat hisoblab bo‘lingan sof foyda va uni bajargan xodim. |
| Tashqi eski JSON | Import qilish **bekor qilingan**. Do‘kon ma’lumotni qayta kiritadi. |
| Demo raqamlari | Foydalanuvchi ularni tozalashni so‘ragan. Yangi hisob bo‘sh. |
| GitHub | Foydalanuvchi barcha tugallangan o‘zgarishlarni yuklab borishni so‘ragan. |
| Demo auditoriyasi | Havolani ochgan har kim demoni ko‘rishi mumkin, deb ruxsat berilgan. |

Do‘kon fotosuratlari talablarni tushunish uchun berilgan; ular majburiy mahsulot
assetlari emas. Eski tashqi JSONni qayta so‘ramang, avtomatik import qilmang yoki
repozitoriyga yuklamang. Ommaviy demo uchun berilgan ruxsat real mijoz telefonlari,
backup fayllari yoki kelajakdagi ishlab turgan ma’lumotlar bazasini ochishga ruxsat emas.

## 4. Rollar va umumiy ish maydoni

### Shaxslar va tarixiy IDlar

| Interfeysdagi ism | Ichki ID | Vazifa |
| --- | --- | --- |
| Otabek | `aziz` | Do‘kon egasi, admin, sotuvchi, xizmat bajaruvchi, mahsulot egasi |
| Boybek | `sardor` | Sotuvchi, xizmat bajaruvchi, mahsulot egasi |
| Asilbek | `jasur` | Sotuvchi, xizmat bajaruvchi, mahsulot egasi |

IDlar oldingi koddan qolgan va tarix buzilmasligi uchun saqlangan. Ularni ismga
moslashtirish maqsadida ommaviy almashtirish mumkin emas. Ko‘rinadigan ismlar
`settings.people` orqali tahrirlanadi; vakolat IDga bog‘langan.

### Panel deganda nima nazarda tutiladi

To‘rtta alohida dastur yo‘q. **Bitta platforma, umumiy operatsion dashboard va
uchta profil** bor. Rolga qarab qo‘shimcha bo‘lim va raqamlar chiqadi.

Hamma uchun kerakli umumiy ma’lumotlar:

- Mavjud mahsulotlar, ularning egasi, qoldig‘i va sotish narx oralig‘i.
- Qarzdorning ismi, telefoni, muddati, qolgan qarzi va to‘lov olish amali.
- Yangi sotuv, mahsulot kiritish va xizmat foydasini yozish uchun tezkor tugmalar.
- Ruxsat berilgan ombor, kam qoldiq va boshqa kundalik amallar.

Umumiy sahifada qisqa ro‘yxatlar ko‘rsatiladi; barcha yozuvlar tegishli mahsulotlar
va qarzdorlar bo‘limida bor. Xodimda boshliqning umumiy moliyaviy raqamlari chiqmaydi.

Otabek savdo va xizmatni xodimlar kabi kiritadi. Admin panelida ham shunga tezkor
tugmalar bor. U barcha sotuvchilar, mahsulot egalari va xizmatlar hisobotini ko‘radi.

### Amaldagi ruxsatlar

`src/access.js`dagi `PERMISSIONS` va `canVisit` asosiy manba.

| Ruxsat | Xodim uchun yangi hisobdagi standart |
| --- | --- |
| `sell` — sotuv | Yoqilgan |
| `credit` — nasiya | Yoqilgan |
| `priceException` — narx oralig‘idan tashqari sotuv | Yoqilgan, sabab talab qilinadi |
| `inventory` — mahsulot va qoldiq | Yoqilgan |
| `products` — mahsulot qo‘shish/tahrirlash | Yoqilgan |
| `stock` — tovar kirimi | Yoqilgan |
| `services` — xizmat foydasi | Yoqilgan |
| `prices` — mavjud katalog narx oralig‘ini o‘zgartirish | **O‘chirilgan** |
| `cash` — izohli pul harakati | Yoqilgan |
| `debts` — qarzdorlar va to‘lov | Yoqilgan |
| `returns` — qaytarish | Yoqilgan |
| `defects` — nuqson qaydi | Yoqilgan |
| `reverse` — o‘z pul yozuvini bekor qilish | Yoqilgan |

Otabek bu ruxsatlarni yoqib-o‘chiradi. `products=true` saqlansa, `stock` ham
yoqiladi. Narxni tahrirlash alohida huquq. Mahsulot egasini mavjud mahsulotda
almashtirish faqat Otabek uchun. Tannarx kiritiladigan shakllar kirim huquqi
berilgan xodimga ochiladi; xodimning tannarxni bilishi foydalanuvchi bilan muhokama qilingan.

Boshqaruv, umumiy foyda va hisobotlar, xodimlar statistikasi, zaxiralar,
boshlang‘ich balanslar va kassa kun yakuni faqat Otabek uchun. Hozir umumiy
hisobotlarni xodimga checkbox bilan berib bo‘lmaydi. Xodim o‘z xizmat foydasini
ko‘radi; hamma xodimning umumiy natijasi Otabekda.

`ensureAccess` eski standart `products/stock=false` yozuvlarini yangi umumiy ish
maydoniga moslaydi. `settings.sharedWorkplaceVersion=1` migratsiya belgisi bor.
Eski auditda boshliq ruxsatlarni ataylab saqlagani topilsa o‘sha cheklovlar saqlanadi.
Bu frontend migratsiyasi; backend uchun alohida server vakolat modeli kerak.

**Hozir shaxsiy xavfsiz kirish yo‘q.** Sahifa Otabek demo roli bilan ochiladi va
rol selecti orqali istalgan profilga o‘tiladi. UI va amallar tekshiruvi haqiqiy
autentifikatsiya yoki ma’lumotni foydalanuvchidan yashirish himoyasi o‘rnini bosa olmaydi.

## 5. Mahsulotlarni qanday hisoblash kerak

Asosiy hisob birligi — **mahsulot guruhi**. Har bir rang va naqsh alohida kartochka
bo‘lishi shart emas. Foydalanuvchi tanlagan misol:

```text
iPhone 15 Pro → Erkaklar uchun → Karbon → O‘rta
```

Shu guruh ichida 20 dona bo‘lishi mumkin: 5 tasi bir xil, qolganlari turli
naqshli. Ular shu hisob guruhida birga sanaladi. Ayollar uchun g‘iloflar boshqa
guruh. Sifat yoki mahsulot egasi boshqa bo‘lsa ham qoldiq alohida bo‘ladi.

Guruhning asosiy farqlari:

```text
brend + model + kim uchun + material + sifat + mahsulot egasi
```

Mavjud boshlang‘ich sifatlar: **Arzon, O‘rta, Pro, Premium**. Bu qat’iy to‘rtlik
emas; Otabek yangi sifat, material, kategoriya va brend yaratishi mumkin.
Erkaklar/ayollar tanlovi hozir koddagi ikki asosiy tanlov; admin orqali bu o‘qni
istalgancha kengaytirish hali qilinmagan.

Materiallar: Karbon, Silikon, Shaffof, Charm, Boshqa. Boshlang‘ich kategoriyalar:
G‘iloflar, Quvvatlagichlar, Kabellar, Quloqchinlar, Himoya oynalari, Aqlli soatlar,
Soat aksessuarlari, Avto aksessuarlar. Ular admin orqali boshqariladi.

`registerCaseGroups` bir shaklda bir nechta sifat qatorini kiritadi. Mavjud aynan
shu guruh topilsa yangi partiya qo‘shadi, boshqa egaga tegishli tovarni qo‘shib yubormaydi.
Oddiy boshqa mahsulot uchun `registerProduct` bor.

Bir guruhga birlashtirilgan naqshlar jismonan farq qilsa ham dastur ularni
bir-biridan ajratmaydi. Shuning uchun bir hisob guruhida chalkashmay sotiladigan,
mos sifat va narx oralig‘idagi tovarlar bo‘lishi kerak. Naqsh bo‘yicha aniq qoldiq
foydalanuvchi tomonidan hozir talab qilinmagan.

## 6. Katalog, qidiruv va sotuv

Ichma-ich ko‘p sahifaga kirib ishlash yoqmaydi. Brend, seriya, qidiruv va filtrlar
bir ish sahifasida ishlaydi. Mahsulotning chizilgan rasmlari o‘rniga brend belgisi
va nom ko‘rsatiladi. Hozir belgilar asosan matn/CSS asosida.

Samsung seriyalari: **S, A, Note, Boshqa modellar**. J2, J5, M23 kabi eski yoki
kam uchraydiganlari Boshqada. Apple va Xiaomi uchun ham seriya qoidalari bor;
barcha yangi brendlar uchun avtomatik to‘liq model bazasi yaratilmagan.

Qidiruv qisqartmalarni tanishi kerak va hozir tanish qoidalari bor:

| Uzun nom | Qisqa yozish |
| --- | --- |
| Samsung S23 | `S23` |
| S23 Plus | `S23+` |
| S23 Ultra | `S23U` |
| iPhone 15 Pro | `iPhone 15P` |
| iPhone 15 Pro Max | `iPhone 15PM` |

`normalizeSearch`, `productIdentity`, `matchesProduct` va `filterCatalog`
funksiyalariga qarang. SKU bo‘yicha ham qidirish bor. Qisqartmalar o‘xshash
variantlarni xato aralashtirmasligi kerak; testlar mavjud.

Sotuv oqimi:

1. Sotuvchi profilini tanlaydi; kelajakda bu haqiqiy login bo‘ladi.
2. Model/guruhni qidirib savatga qo‘shadi.
3. Soni, mahsulot egasi va xaridor bilan kelishilgan narxni tekshiradi.
4. To‘lov turini, olingan pulni va kerakli izohni kiritadi.
5. Saqlaganda FIFO qoldiq kamayadi, chek, pul harakati va kerak bo‘lsa qarz yoziladi.

Savatdagi egani o‘zgartirish shunchaki `owner` matnini almashtirish emas.
`selectCartOwner` shu model/material/sifatdagi boshqa egaga tegishli haqiqiy
guruhga o‘tadi. Mos tovar yoki yetarli qoldiq bo‘lmasa amal rad qilinadi.

## 7. Narxlar, savdolashish va tannarx

Uchta tushunchani aralashtirmang:

| Tushuncha | Ma’nosi |
| --- | --- |
| Tannarx, foydalanuvchi aytgan «asl narx» | Do‘konga mahsulotni sotib olish qancha tushgani |
| Sotish narx oralig‘i | Sotuvchiga ko‘rsatiladigan eng kam va yuqori narx |
| Haqiqiy sotilgan narx | Xaridor bilan kelishilib chekda yozilgan narx |

Masalan, karbon g‘ilof 20 000 UZSga olingan va 30 000 UZSga sotilgan: mahsulot
bo‘yicha yalpi foyda 10 000 UZS. Soliq, ijara va boshqa xarajatlar keyin alohida
hisoblanadi. Omborga kelgan tovar uchun pul chiqishi bilan uning hammasini shu
kunning sof foydasidan yana tannarx sifatida ayirish mumkin emas.

Foydalanuvchi savdolashish misoli: narx 10 000, xaridor 5 000 taklif qiladi,
7 000ga kelishiladi. Yoki sotuvchiga **10 000–20 000** oraliq ko‘rsatiladi:
avval yuqori narxdan boshlaydi va kelishilgan narxni yozadi.

Oxirgi kelishuv bo‘yicha oraliq mutlaq blok emas. Do‘st/qarindoshga tannarxda
yoki **0 so‘mga sovg‘a** qilish ham bo‘lishi mumkin. Narx oralig‘idan tashqari
sotuv uchun tegishli ruxsat va sabab kerak; xodim qilsa Otabekka platforma eslatmasi tushadi.
Haqiqiy sotish narxini yozish katalogning narxi yoki tannarxini o‘zgartirmaydi.

Har kirim partiyasining tannarxi alohida saqlanadi. Bir xil mahsulot keyin
boshqa narxda kelishi mumkin. Sotuv tannarxi **FIFO**: oldingi partiyadan boshlanadi.
`cost(product)` hozirgi qoldiqning o‘rtacha ko‘rsatkichidir; chek foydasini
hisoblashda bu taxminiy ko‘rsatkichni FIFO snapshoti o‘rniga ishlatmang.

## 8. Pul, foyda va mahsulot egaligi

Hamma mahsulot uchun tushum bitta umumiy kassaga yoziladi. `Naqd`, `Karta`,
`O‘tkazma` chekdagi to‘lov turi; hozir uchta alohida bank/kassa hisobining real
integratsiyasi yo‘q. Avvalgi `till1`, `till2`, `bank` faqat eski ma’lumotni o‘qish
va migratsiya qilish uchun qo‘llab-quvvatlanadi.

Asosiy hisoblar:

```text
Savdo summasi = sotilgan son × haqiqiy sotilgan narx
Sotilgan tovar tannarxi = chekdagi sarflangan FIFO partiyalari qiymati
Yalpi foyda = savdo summasi − sotilgan tovar tannarxi

Sof natija = yalpi foyda
           + qo‘shimcha daromad
           + qo‘shimcha xizmat sof foydasi
           − kiritilgan xarajatlar
           − yaroqsiz tovar zarari
           − shu hisobotga kiradigan ijara
```

Masalan, sotuvchining savdo summasi 500 000 va sotilgan tovar tannarxi 200 000
bo‘lsa yalpi foyda 300 000. Bu hali barcha umumiy xarajatlar ayrilgan sof foyda
degani emas. Foydalanuvchi og‘zaki «foyda»ni ba’zan savdo summasi ma’nosida ham
ishlatgan; interfeysdagi aniq atamalarni saqlang.

Kassa qoldig‘i bilan foyda teng bo‘lishi shart emas: nasiya, tovar xaridi,
shaxsiy pul qo‘shish va boshliqqa topshirish ularni turlicha o‘zgartiradi.
Sotilmagan ombor zaxirasining tannarxi va yuqori narxdagi qiymati alohida ko‘rsatiladi.

Sotuvchi va egani ajrating:

```text
Boybek Otabekning mahsulotini sotsa:
sale.seller = sardor
sale.items[n].owner = aziz
pul hisobi = cash
```

Chekdagi har qatorning egasi alohida bo‘lishi mumkin. Egalar hisobotida o‘z
mahsulotlari, xodimlar hisobotida esa kim sotgani hisoblanadi. Uchta egaga
umumiy kassadagi pulni qachon va qanday bo‘lib berish **hali kelishilmagan**.
Avtomatik qarzdorlik, ulush yoki foyda taqsimotini o‘zingizcha qo‘shmang.

## 9. Xarajatlar, shaxsiy pul, maosh va ijara

Har pul harakatida izoh kerak: nima uchun keldi yoki ketdi. Maosh, soliq,
transport, elektr, internet va boshqa kunlik xarajatlar yozilishi mumkin.
Qo‘shimcha daromad bo‘limi foydalanuvchi xohishi bilan umumiy ehtiyoj uchun bor.

| Amal | Foydaga ta’siri | Pul/xodim qarziga ta’siri |
| --- | --- | --- |
| `expense` | Xarajat sifatida ayriladi | Kassadan bo‘lsa pul kamayadi |
| Shaxsiy puldan xarajat | Bir marta xarajat | Do‘konning xodimga qarzi paydo bo‘ladi |
| `income` | Qo‘shimcha daromadga qo‘shiladi | Kassa oshadi |
| `contribution` | Daromad emas | Kassa oshadi; xodim qo‘shsa unga qaytariladigan pul oshadi |
| `withdrawal` | Xarajat emas | Boshliqqa topshirilgan pul kassadan chiqadi |
| `reimbursement` | Ikkinchi marta xarajat emas | Xodimga qaytariladigan qarz va kassa kamayadi |
| Qarz to‘lovi | Qayta savdo/daromad emas | Xaridor qarzi kamayadi, kassa oshadi |

Otabekning o‘zi qo‘shgan pul xodimlar kabi do‘konning unga avtomatik qarziga
yozilmaydi (`staffPayable` boshliq uchun 0 qaytaradi). Boshliq kapitali alohida
to‘liq buxgalteriya moduli sifatida qurilmagan.

Kunlik ish haqini Otabek ko‘rsatkichlarni ko‘rib o‘zi kelishadi. Tizim maosh
foizini avtomatik hisoblamaydi. To‘langan ish haqi qo‘lda xarajat sifatida yoziladi.
Eski test ma’lumotidagi komissiya foizlarini jonlantirmang.

**Ijara:** foydalanuvchi murakkab avtomatlashtirishdan voz kechib, har oy ijara
summasini oddiy yozishni tanlagan. `setRent(month, amount, note, ...)` o‘sha oy
uchun kelishilgan xarajatni saqlaydi. Haqiqiy to‘lov `payRent` orqali alohida:
pul kamayadi, ammo ijara foydadan ikkinchi marta ayrilmaydi.

Ijara hozir **oy/yil/umumiy** do‘kon hisobotiga kiradi. Kun/haftaga yoki har
xodimga avtomatik taqsimlanmaydi. To‘langan puldan kam ijara summasi kiritilmaydi.
To‘langan ijarani o‘chirish uchun avval to‘lovlari bekor qilinadi. Ijara yozuvi
havolalar uzilmasligi uchun nol summa va `cancelledAt` bilan tarixda qoladi;
shu oy uchun qayta belgilash uni qayta faollashtiradi.

## 10. Qo‘shimcha xizmatlar

Oxirgi katta qo‘shimcha. Telefon ta’miri yoki telefon oldi-sotdisi kabi ishda
xodimlar kirim-chiqimni o‘zlari hisoblab, **faqat qolgan sof foydani** kiritishni
so‘rashgan. Hozir to‘liq ta’mir buyurtmasi, ehtiyot qism ombori, IMEI, qurilma
qabul dalolatnomasi yoki telefon oldi-sotdisi hisobini boshqarish qurilmagan.

Xizmat yozuvi:

- Xizmat nomi.
- Uni bajargan xodim (`worker`).
- Kiritgan shaxs (`actor`), boshliq boshqa xodim uchun ham kiritishi mumkin.
- Sof foyda — butun, manfiy bo‘lmagan UZS.
- Izoh, vaqt va sana.

Natija umumiy sof foyda va bajargan xodim hisobotiga tushadi. Amaldagi owner
filtri ham xizmatni `worker`ga bog‘laydi. Bu mahsulot egalari o‘rtasida xizmat
pulini bo‘lish qoidasi kelishilganini anglatmaydi.

Xodim o‘z xizmatini tahrirlaydi/bekor qiladi; hamkasbinikini o‘zgartirmaydi.
Otabek barchasini boshqaradi. Tahrirda eski yozuv bekor qilinadi va yangi yozuv
`replaces` bilan bog‘lanadi. O‘chirish asl yozuvni yo‘qotmaydi: `cancelledAt`
saqlanadi, foyda bekor qilish sanasida teskari hisoblanadi.

**Muhim amaldagi xulq:** xizmat foydasi kassaga yana tushum yozmaydi va savdo
aylanmasiga kirmaydi. Uni qo‘shimcha daromadga ham yozish foydani ikki marta
hisoblaydi. Kelajakda xizmatning kassadagi real pul harakati qanday aks etishi,
agar kerak bo‘lsa, alohida kelishilishi lozim; faqat foydadan yalpi tushumni
taxmin qilib yaratmang. Manfiy xizmat natijasi maxsus service loss sifatida
hozir qabul qilinmaydi; bunday holat qoidasini foydalanuvchidan aniqlash kerak.

## 11. Qarzdorlar va qaytarish

Nasiya kam bo‘lsa ham bo‘ladi. Masalan, 100 000lik savdodan 50 000 hozir olinadi,
qolgan 50 000 qarz bo‘lib qoladi. Kerakli maydonlar: ism, telefon, qarz sababi,
qaytarish muddati va summa. Odatdagi to‘lovda butun savdo summasi bilan olingan
pul farqi avtomatik qarzga tushadi.

Savdo va uning tannarxi savdo vaqtida hisoblanadi. Keyingi qisman/to‘liq qarz
to‘lovi pul va qoldiq qarzni o‘zgartiradi; foydani yana oshirmaydi. Ruxsatli
istalgan xodim qarz to‘lovini oladi; kim olgani tarixda qoladi va Otabekka
platforma eslatmasi tushadi.

Platformada muddati kelgan, yopilmagan qarz uchun eslatma bor. Hozir native
telefon push/SMS/Telegram, alohida mobil ilova yoki fon scheduler yo‘q.

Boshlang‘ich eski qarzlarni boshliq alohida kiritadi; ular yangi daromad emas.
Qarzdor metama’lumotlari tahrirlanadi. Boshlang‘ich qarz summasini Otabek haqiqiy
qaytgan to‘lovdan kam bo‘lmagan qilib tuzatishi mumkin. Sotuvga bog‘langan qarz
summasi alohida o‘ylab o‘zgartirilmaydi: chek yoki to‘lov tuzatiladi.

Chekni sabab bilan to‘liq qaytarish mumkin:

- Aynan sarflangan partiyalarning soni omborga qaytadi.
- Savdoda va keyingi qarz to‘lovlarida **haqiqatan olingan** pul qaytariladi.
- Hali olinmagan qarz bekor qilinadi.
- Savdo va tannarx ta’siri qaytarish sanasida teskari hisoblanadi.
- Bir chekni ikki marta qaytarish bloklanadi.

Almashtirish — avval eski chekni qaytarish, keyin yangi sotuv. Qisman chek
qaytarish hali yo‘q. Cheki qaytarilgan qarzning to‘lovini keyin mustaqil bekor
qilish ham bloklanadi: aks holda ilgari qaytarilgan pul chalkashadi.

## 12. Kam qoldiq, nuqson va kassa yakuni

### Kam qoldiq

Har mahsulot guruhida `min` bor. Masalan, quvvatlagich uchun 10, SmartWatch
uchun 2, g‘ilof guruhi uchun 3. Bu global bir xil son emas.

```text
Kam qoldiq = stock(product) <= stockLimit(product)
stock = barcha partiyalardagi qolgan qty yig‘indisi
```

`min=0` faqat tugaganda eslatadi. Eski/yo‘q/noto‘g‘ri limit uchun fallback 5.
Yangi guruh yaratilayotganda chegara kiritiladi; keyin tahrirlanadi. Mavjud
guruhga yangi partiya qo‘shish uning ilgari tanlangan chegarasini yashirin
almashtirmaydi. `Kam qoldiqlar` sahifasi, qidiruv, egasi filtri, tugagan guruhlar
va eslatma belgisi bor. Qoldiq to‘ldirilsa ogohlantirish avtomatik yo‘qoladi.
Faol katalogdan olib tashlangan mahsulot bu operatsion ogohlantirishlarda chiqmaydi.

### Nuqson

Tuzatib sotiladigan tovar uchun ta’mir xarajati yoziladi, soni ombordan shunchaki
yo‘qolmaydi; keyin sabab bilan arzonroq sotiladi. Yaroqsiz tovar esa FIFO
tannarxida bir marta zararga chiqariladi. Otabek nuqson tarixini tuzatishi yoki
bekor qilishi mumkin; son va zarar birga qaytariladi. Yangi nuqson yozuvlarida
partiya `alloc`i saqlanadi. Eski `alloc`siz nuqsonlar uchun kodda miqdor va jami
tannarxni saqlovchi qaytarish yo‘li bor, bu asl individual partiyalarni qayta
topgan degani emas.

### Kun yakuni

Otabek umumiy kassani sanaydi, haqiqiy summani, ertangi qaytimni va izohni
kiritadi. `difference = actual - expected`. Farqni daromad yoki xarajat deb
avtomatik yashirmang. Hozir faqat sanashni saqlash yoki pulni topshirishni ham
yozish tanlanadi. Topshirilsa `actual - float` bitta withdrawal sifatida yoziladi.

Kassa sanog‘ini tahrirlashda bog‘langan faol topshirishlar bekor qilinadi va
to‘g‘rilangan topshirish hozirgi sanada yoziladi. O‘chirish ham topshirish
ta’sirini qaytaradi, tarixni saqlaydi. Oylik, haftalik «nolga tushish» bilan
ertangi qaytim yoki umumiy kassa qoldig‘ini nol qilib yubormang.

## 13. CRUD va tarixni saqlash

Foydalanuvchi noto‘g‘ri kiritilgan nom, narx, summa va boshqa ma’lumotni tuzatish
uchun to‘liq nazorat xohlaydi. «LEGO» — sozlash erkinligi haqidagi o‘xshatish,
interfeysni o‘yin yoki blok muharririga aylantirish topshirig‘i emas.

O‘chirish birinchi tugmada bajarilmaydi. Kichik oynada **O‘chirilsinmi?**, yozuv
nomi, nima o‘zgarishi, sabab maydoni va **Yo‘q / Ha, o‘chirilsin** bo‘lsin.
Mavjud `confirmDelete`/`delete-form` shu jarayonni birlashtiradi.

| Yozuv | Hozirgi tuzatish/o‘chirish xulqi |
| --- | --- |
| Mahsulot | Nom, model/xususiyat, tasnif, sifat, limit va ruxsatga ko‘ra narx tahrirlanadi. Egani Otabek o‘zgartiradi. |
| Mahsulotni o‘chirish | Otabek faol katalogdan arxivlaydi; qoldiq va cheklar saqlanadi. Boshqaruvdan tiklanadi. |
| Arxiv qoldig‘i | Katalogdan yo‘qolishi mahsulot jismonan yo‘qoldi degani emas; ombor qiymatida qoladi. |
| Tasniflar | Otabek qo‘shadi, nomlaydi, o‘chiradi. Bog‘langan mahsulotlarga almashtiruvchi tasnif tanlanadi. Kamida bir tanlov qoladi. |
| Brend/sifat tarixi | Olib tashlanganlari tarixiy havolalar uchun `archived` bilan saqlanadi, faol tanlovlarda chiqmaydi. |
| Chek | Faol o‘z chekini xodim, barchasini Otabek tuzatadi. Eski chek qaytarilib yangi chek yaratiladi. `corrects/correctedBy` havolalari bor. |
| Chekni o‘chirish | Aslida to‘liq qaytarish/bekor qilish; mahsulot, pul va qarz birga tuzatiladi. Tarix qoladi. |
| Pul yozuvi | O‘z yozuvini xodim, barchasini Otabek bekor qiladi. Tahrir reversal + to‘g‘ri yangi yozuv. |
| Qarzdor | Ism, telefon, muddat, izoh tahrirlanadi. Sotuv qarzi chek/to‘lov orqali tuzatiladi. |
| Boshlang‘ich qarzni o‘chirish | Otabek, faqat faol to‘lovsiz holatda; nol qoldiq va bekor qilish tarixi saqlanadi. |
| Tovar kirimi | Otabek son/tannarx/izohni tuzatadi; partiya ishlatilgan bo‘lsa eski tannarx va sarflangan miqdor saqlanadi. |
| Kirimni o‘chirish | Bog‘langan savdo/nuqsonsiz, ishlatilmagan partiya uchun. Qoldiq va kassa ta’siri qaytariladi, yozuv tarixda. |
| Eski noaniq partiya | `lotId` yo‘q va yagona mos lot topilmasa xavfli taxmin bilan tahrir qilinmaydi. |
| Xizmat | O‘z xizmatini xodim, barchasini Otabek. Bekor qilish foydani o‘z sanasida tuzatadi. |
| Ijara | Oy summasi va izohi; to‘langan summa himoyalanadi. O‘chirishda havola saqlanadi. |
| Kassa sanog‘i/nuqson | Otabek tahrirlaydi/bekor qiladi; tegishli pul yoki qoldiq ta’siri tuzatiladi. |
| Ismlar va do‘kon nomi | Sozlamalar/Boshqaruvda tahrirlanadi; barqaror IDlar o‘zgarmaydi. |

Bu barcha ma’lumotlarni SQL DELETE bilan yo‘qotish talabi emas. Audit, bog‘langan
chek va lot havolalarini buzadigan amallarni bloklash — hozirgi hisobning muhim
qismi. Admin erkinligi yangi moliyaviy xatoga olib kelmasligi kerak.

Oddiy metadata va ayrim boshlang‘ich/kirim/ijara tahrirlari amaldagi yozuvni
yangilab audit qoldiradi. Chek, pul, xizmat va nuqson bekor qilishlari esa vaqtli
teskari ta’sir bilan hisoblanadi. Hamma tahrir bir xil, qat’iy append-only ledger
bo‘ldi deb hisoblamang; production ledger siyosatini alohida rejalashtirish kerak.

## 14. Hisobot davrlari

Foydalanuvchining tanlagan chegaralari odatiy kalendar yarim tuni emas:

| Davr | Asia/Tashkent bo‘yicha yangi davr boshlanishi |
| --- | --- |
| Kun | Har kuni 07:00 |
| Hafta | Yakshanba 23:00 |
| Oy | Har oyning 1-sanasi 07:00 |
| Yil | 31-dekabr 23:00 |
| Umumiy | Davom etadi, davriy nolga tushmaydi |

«0 ga tushish» eski yozuvlarni o‘chirish emas, yangi hisobot oynasini boshlash.
Ombor, qarz, pul, oldingi tarix saqlanadi. Sana taqqoslashda serverning lokal
timezoneidan foydalanmang. Hozir `reportWindow`, `eventTime`, `inWindow` va
`localDate` bu ishni bajaradi; ISO `at`, eski yozuvlarda sana/vaqt fallbacki bor.
Umumiy hisobotning hozirgi quyi chegarasi kodda 2000-01-01.

Yillik 31-dekabr 23:00 va oylik 1-yanvar 07:00 orasida 8 soat farq bor. Bu
hozirgi kelishilgan xulq; uni «xato» deb o‘zingizdan almashtirmang. O‘zgartirish
kerak bo‘lsa foydalanuvchi bilan alohida kelishing.

## 15. Dizayn va telefonda ishlash

O‘zbekcha, sodda va aniq. Sotuvchi ko‘p ichma-ich sahifaga kirmasin. Avval
kompyuter ko‘rinishi tayyorlangan, keyin foydalanuvchi telefon asosiy qurilma
ekanini aytgan. Mobil imkoniyatlarni refaktorda yo‘qotmang.

Telefon menyusi: **Asosiy, Ombor, Sotuv, Tarix, Bo‘limlar**. Qo‘shimcha xizmat,
qarzdorlar, kam qoldiq, admin va boshqalar Bo‘limlarda. Qidiruv birinchi o‘rinda,
brand/series/category/filterlar gorizontal suriladi. Jadval yozuvlari mobil
kartalarga aylanadi. Raqamli klaviatura, kattaroq bosish maydoni, pastdan
ochiladigan modal, safe-area va scroll/fokus boshqaruvi bor. Sotuvda mobil savat
xulosasi jami son va summani ko‘rsatadi.

`index.html` CSS tartibi muhim:

```text
src/style.css → src/themes.css → src/responsive.css
```

To‘rtta mavzu foydalanuvchi bergan palitralardan tuzilgan:

| ID / nom | Asosiy palitra |
| --- | --- |
| `earth` / Sahro | `#2D4354 #73766A #FED7A5 #9E6752 #534145 #20212B` |
| `forest` / O‘rmon | `#051F20 #0B2B26 #163832 #235347 #8EB69B #DAF1DE` |
| `sky` / Osmon | `#223A5E #355982 #4D79A8 #6E9ECC #9FC0E3 #D0E1F2 #F3F8FD` |
| `glass` / Shisha | `#03195B #0B2CB1 #1951FC #3781FC #CBE9FD` |

Standart O‘rmon. Shisha — macOS/iOS ruhidagi blur, shaffof qatlam, yorug‘lik va
yumshoq harakat. Aynan Apple komponentining to‘liq nusxasi talab qilinmagan.
Animatsiya hissiyot uyg‘otsin, lekin kassadagi ishni sekinlashtirmasin.
`prefers-reduced-motion` va blur bo‘lmagan qurilma uchun fallback saqlansin.

Ranglar uchun semantik CSS o‘zgaruvchilaridan foydalaning: `--panel`, `--surface`,
`--ink`, `--muted`, `--accent`, `--accent-ink`, `--line`, `--warning`, `--danger`.
Bir yangi komponent faqat O‘rmon mavzusida o‘qiladigan qilib yozilmasin.

## 16. Hozirgi texnik arxitektura

Bu React/Vite/Next loyihasi emas. **Oddiy JavaScript ES modules va CSS**, Node.js
22+ bilan ishlaydigan kichik statik frontend. `package.json`da tashqi npm
dependency yo‘q. Port 4173 bo‘lgani Vite ishlatilgan degani emas.

| Fayl | Vazifasi |
| --- | --- |
| `index.html` | O‘zbekcha app shell, CSS tartibi, boshlang‘ich theme script, modal/toast root |
| `src/app.js` | Sahifalar, render, UI filtrlar, savat, modal, event delegation, mahalliy saqlash |
| `src/access.js` | Barqaror shaxs IDlari, display nomlar, ruxsatlar, sahifa kirishlari |
| `src/admin.js` | Katalog tasniflari, ularning CRUDi, staff ruxsatlari va nomlar |
| `src/model.js` | Bo‘sh state, stock/min/cost, FIFO checkout/refund/purchase, pastki darajadagi hisob |
| `src/business.js` | Atomar savdo, qarz, pul ledgeri, qaytarish, ijara, kassa sanog‘i, hisobotlar |
| `src/management.js` | Mahsulot/qarz/kirim/chek/pul/ijara/sanoq/nuqson tuzatishlari, xizmatlar, audit |
| `src/inventory-entry.js` | Oddiy mahsulot va guruhlab kirim, katalog narxi va kam qoldiq limiti |
| `src/catalog.js` | Brend/seriya, modelni tanish, qisqartmalar, qidiruv, sifatlar |
| `src/ownership.js` | Savatda haqiqiy egaga tegishli guruhni tanlash |
| `src/backup.js` | JSONni tekshirish, havolalar va hisob mosligi, migratsiya, zaxira xulosasi |
| `src/themes.js` / `themes.css` | To‘rt mavzu, persistence, ranglar va harakat |
| `src/responsive.js` / `responsive.css` | Mobil kartalar, inputmode va adaptiv UI |
| `src/style.css` | Asosiy kompyuter UI stillari |
| `sw.js` | Faqat frontend shell uchun offline cache |
| `scripts/serve.mjs` | Allowlist bilan localhost server, dev va dist preview |
| `scripts/build.mjs` | `dist/`ni qayta yaratib index, sw va srcni ko‘chiradi |
| `.openai/hosting.json` | Mavjud Sites loyihasining identifikatori, `static.directory=dist` |
| `tests/fixtures.mjs` | Faqat testlar uchun sun’iy ma’lumot, browser bundle emas |
| `tests/*.test.mjs` | Biznes, qidiruv, ruxsat, FIFO, tuzatish, zaxira va mavzu regressiyalari |

`app.js` hozir bitta katta, ko‘p joyi juda uzun satrli fayl. Katta outputni
to‘liq o‘qib kontekstni isrof qilmang: kerakli funksiya/satrlarni `rg` va kichik
o‘qishlar bilan toping. Refaktor foydali bo‘lishi mumkin, lekin yangi topshiriq
bo‘lmasa frameworkga ko‘chirishni boshlamang.

### UI state va saqlash oqimi

`state` do‘kon yozuvlari; `user/page/period/owner/query/brand/series/...` UI holati;
`cart` hali yakunlanmagan savat. UI `render()`da HTML bilan qayta chiziladi.
Amallar `data-action` va form IDlari orqali event delegationda bajariladi.

`mutate(fn)` amaldagi state nusxasida amal bajaradi va avval localStoragega
yozadi. Saqlash muvaffaqiyatli bo‘lgandan keyin jonli state almashtiriladi.
Quota yoki saqlash xatosida foydalanuvchiga muvaffaqiyat deb ko‘rsatilmasin.

Biznes funksiyalaridagi `atomic` ham draft bilan ishlaydi. Ular `Object.assign`
bilan state arraylarini almashtirgani uchun ichma-ich atomar amaldan oldin olingan
object reference keyin eskirishi mumkin. Murakkab tuzatishda uni ID bilan qayta
toping; `updateClosing`dagi misol va regressiya testiga qarang.

`model.js`dagi `metrics` va `expectedCash` eski oddiy hisob yordamchilari/test
mosligi uchun bor. Zamonaviy UI hisobining manbai **`businessReport` va
`accountBalances`**. Yangi services/reversal/rent/debt hisobini eski helperga ulab
yuborish noto‘g‘ri natija berishi mumkin.

## 17. Ma’lumot shakli va muhim bog‘lanishlar

Root format versiyasi `version:1`. Bu localStorage nomidagi `v2` bilan bir xil
raqam bo‘lishi shart emas. `createEmptyState` minimal state yaratadi;
`prepareState` qolgan array va sozlamalarni qo‘shadi.

```text
state
  version
  products[]   sales[]      expenses[]   purchases[]   payouts[]
  closings[]   audit[]      movements[]  debts[]       rents[]
  notices[]    operations[] defects[]    services[]
  settings
    shop
    people[]
    permissions[personId][permissionId]
    catalog { categories[], materials[], qualities[], brands[] }
    caseCategory?
    openingAccounts { cash }
    openingPayables?
    sharedWorkplaceVersion
```

| Yozuv | Asosiy maydonlar/bog‘lanish |
| --- | --- |
| Product | `id, sku, name, variant, category, brand, model?, audience?, material?, quality?, qualityLabel?, grouped?, owner, price, minPrice, min, lots[], archivedAt?` |
| Lot | `id, qty, cost, date` — `qty` qolgan son, `cost` bir dona tannarxi |
| Sale | `id, operationId, at, date, time, seller, payment, items[], account, received, note, ledger, exception, returned, returnAt?, corrects?, correctedBy?` |
| Sale item | `productId, qty, price, owner, name/variant/model snapshotlari, minPrice/listPrice snapshotlari, cost, alloc[]` |
| Sale item cost | **Qatorning jami tannarxi**, bir dona tannarxi emas |
| Allocation | `lotId, qty, cost` — bu yerda cost bir dona tannarxi |
| Purchase | `id, productId, lotId?, qty, cost, owner, actor, date, at, payment, account, note, deletedAt?` |
| Movement | `id, actor, kind, amount, account, note, at, date, operationId, reference?, person?, reversalOf?, voidedBy?` |
| Debt | `id, saleId? yoki opening:true, customer, phone, due, note, original, balance, actor, at, payments[], cancelled?` |
| Rent | `id, month, amount, paid, note, actor, at, cancelledAt?` |
| Closing | `id, actual, expected, difference, float, handover, withdrawalIds[], note, actor, date, at, cancelledAt?` |
| Defect | `id, kind:dispose, productId, owner, qty, cost, alloc?, note, actor, at, cancelledAt?` |
| Service | `id, title, worker, actor, profit, note, at, date, replaces?, replacedBy?, cancelledAt?, cancelledActor?` |
| Operation | Noyob `id`, actor, kind, at va `status:local` — serverga yetkazilganlik tasdig‘i emas |
| Audit | Kim/qachon/nima qilgani; ayrim tuzatishlarda `before/after` snapshotlari |

`expenses` va `movements` ayrim xarajatlarni ikkala ko‘rinishda saqlaydi.
`ledger` flagi pulni ikki marta ayirmaslik uchun muhim. Qarz `payments[]`
yozuvi ham tegishli `movements` yozuviga bog‘langan. Refund aynan savdo
allocationlariga tayanadi. Shu aloqalarni migratsiyada saqlang.

Hozir UUID operation/ko‘p entity IDlar bor, ammo chek `S-1001` kabi lokal
ketma-ket raqam, SKU ham lokal ro‘yxatdan hosil qilinadi. Ikki qurilma offline
yozuvlarini birlashtirishda bular global unique deb qabul qilinmaydi. Backend
identifikatori, ko‘rinadigan raqam va idempotency kalitini rejalashtirish zarur.

## 18. Mahalliy saqlash, backup va offline

| Kalit | Vazifasi |
| --- | --- |
| `telefonzona-v2` | Amaldagi biznes state |
| `telefonzona-v2-before-restore` | So‘nggi tiklashdan oldingi nusxa |
| `telefonzona-theme` | Faqat ko‘rinish tanlovi |
| `telefonzona-v1`, `telefonzona-before-restore` | Eski demo kalitlari, yangi hisob mavjud bo‘lgach olib tashlanadi |

**Amaldagi v2 ma’lumotlarni o‘chirmang va kalitni ko‘r-ko‘rona yangilamang.**
Foydalanuvchining oldingi «hamma test raqamlarini o‘chir» degan topshirig‘i
kelajakda real to‘ldirilgan v2ni har yangilanishda tozalashga ruxsat emas.

Saqlash origin bo‘yicha. `localhost:4173`, `localhost:4176` va ochiq saytning
localStoragei boshqa-boshqa. Bir qurilmada kiritilgan yozuv boshqa telefon yoki
laptopda avtomatik ko‘rinmaydi. Bir originning boshqa tabidagi `storage` hodisasi
UI yangilanishiga yordam beradi, lekin bu server sinxronlashuvi yoki parallel
yozuvlar uchun ACID tranzaksiya emas.

Backup: boshliq JSONni yuklab oladi; importda 8 MB limit, versiya, IDlar,
raqamlar, lot allocationlari, qarz tengligi, reverse havolalar va boshqa bog‘lanishlar
tekshiriladi. Shubhali/prototype JSON kalitlari ham rad qilinadi. Tiklashdan oldin
Hozir/Faylda solishtirish va aniq tasdiq bor. Eski holat recovery kalitiga
saqlanadi. Har restore o‘sha recovery nusxasini yangilaydi; u doimiy arxiv emas.
Fayl ko‘rib chiqilayotganda boshqa tab ma’lumotni o‘zgartirsa restore to‘xtatiladi.

`sw.js` cache nomi hozir **`telefonzona-shell-v9`**. Faqat allowlistdagi frontend
fayllari network-first, offline cache fallback bilan ishlaydi. Biznes state server
keshi emas. Elektr o‘chishi yoki qurilma xotirasi buzilishidan mutlaq himoya yo‘q;
brauzer xotirasi tozalansa backup bo‘lmasa yozuv yo‘qolishi mumkin.

Yangi JS modul qo‘shsangiz:

1. `scripts/serve.mjs`ning allowed fayllariga qo‘shing.
2. Offline kerak bo‘lsa `sw.js` FILESga qo‘shing va shell cache versiyasini oshiring.
3. `package.json`dagi explicit `node --check` ro‘yxatini tekshiring.
4. `scripts/build.mjs` butun `src/`ni distga ko‘chiradi; buildda private fayl srcga tushmasin.

Dev server loyiha rootini ochiq fayl serveri sifatida tarqatmaydi. `GET/HEAD`
va aniq frontend allowlisti bor. `.git`, config, testlar yoki backupni browserga
chiqarish uchun allowlistni umumiy qilib yubormang.

## 19. Tayyor va hali qilinmagan ishlar

| Yo‘nalish | Hozirgi holat |
| --- | --- |
| O‘zbekcha, telefon/kompyuter frontend | Bor |
| To‘rt tema va animatsiyalar | Bor |
| Bo‘sh hisob bilan boshlash | Bor |
| Flat katalog, qisqartma qidiruv | Bor |
| Guruhlab kirim, FIFO, uchta mahsulot egasi | Bor |
| Sotuv, savdolashish, sababli istisno | Bor |
| Nasiya, qisman to‘lov, qarzdorlar | Bor |
| Kam qoldiqning individual chegaralari | Bor |
| Pul kirim-chiqimi va xodimga qaytariladigan pul | Bor |
| Oylik ijara va alohida to‘lov | Bor |
| Kassa sanog‘i, qaytim, farq, topshirish | Bor |
| Xizmat sof foydasi va xodimga bog‘lash | Bor |
| Tuzatishlar, tasdiqli o‘chirish, audit | Bor, yuqoridagi bog‘lanish cheklovlari bilan |
| Kun/hafta/oy/yil/umumiy hisob | Bor |
| JSON backup/restore, CSV eksport | Bor |
| Offline interfeys va mahalliy saqlash | Bor |
| Haqiqiy login, parol, session | **Yo‘q** |
| Backend API va doimiy server bazasi | **Yo‘q** |
| Serverdagi role/ownership tekshiruvlari | **Yo‘q** |
| Ikki qurilma offline navbati va sinxronlash | **Yo‘q** |
| Serverda duplicate/conflict yechimi | **Yo‘q** |
| Telefon push/SMS, fon scheduler | **Yo‘q** |
| Native mobil ilova | **Yo‘q** |
| To‘liq PWA install jarayoni | Alohida to‘liq tayyorlangan deb hisoblamang; hozir service worker shell bor |
| Avtomatik maosh foizi | **Yo‘q, qoida kelishilmagan** |
| Uch egaga pul/foyda bo‘lish | **Yo‘q, qoida kelishilmagan** |
| Qisman chek qaytarish | **Yo‘q** |
| Majburiy QR/printer/skaner | Hozirgi jarayonga kiritilmagan |
| Telefon ta’mirining to‘liq CRM/ombori | **Yo‘q**, faqat xizmat sof foydasi bor |
| Soliq stavkasini avtomatik hisoblash va davlat/bank integratsiyasi | **Yo‘q** |
| Cheklanmagan yangi xodim/profil yaratish | **Yo‘q**, hozir uchta stable profil |
| Istalgan katalog o‘qi va seriya qoidasi uchun visual builder | **Yo‘q**, mavjud tasnif CRUDi va koddagi qoidalar bor |

Bu jadvaldagi «Yo‘q»lar hammasini foydalanuvchidan so‘ramay bir yo‘la qurish
topshirig‘i emas. Avval uning keyingi maqsadini oling. Hozirgacha asosiy faol
ish frontend bo‘lgan; production backendga o‘tish alohida bosqich.

## 20. Kelajakda aniqlashtiriladigan masalalar

1. Uchta egaga tegishli savdo pullari qachon, qanday va kim tomonidan ajratiladi?
   Kiritilgan tovar xaridi kimning pulidan bo‘ladi, egalararo qarz kerakmi?
2. Xizmatning sof foydasi kimga tegishli, kassaga tushgan real yalpi pul qayerda
   yuritiladi, zararli xizmat qanday qayd etiladi?
3. Kelajakdagi maosh foizi tushumdanmi, yalpi foydadanmi, xizmat foydasidanmi?
   Qaytarish/sovg‘a/qarz hisobiga qanday qoida qo‘llanadi?
4. Production login usuli, qurilma egalari, parol tiklash, xodimni chiqarish va
   uning offline kutilayotgan yozuvlari uchun siyosat qanday bo‘ladi?
5. Ikki qurilma bir xil oxirgi tovarni offline sotsa nima qilinadi? Bu masala
   oddiy sync retry bilan o‘zi hal bo‘lmaydi; biznesga mos konflikt oqimi kerak.
6. Bir guruh ichidagi muayyan naqsh/rangga alohida qoldiq keyin zarur bo‘ladimi?
   Hozir umumiy guruh yechimi qabul qilingan.
7. Qisman qaytarish, katta hajmdagi bulk kiritish, inventarizatsiya tuzatishi va
   tarixiy tannarx xatosi uchun alohida oqim kerak bo‘ladimi?
8. Avtomatik server backup, retention, tiklash sinovi va production hosting uchun
   budjet/texnologiya qanday bo‘ladi?

Bular takror so‘ralishi kerak bo‘lmagan aniq kelishuvlardan farq qiladi.
Masalan, «ikki kassami?», «Boybekning mahsuloti ham bormi?» yoki «rasm shartmi?»
degan eski savollarga javob bu hujjatda allaqachon bor.

## 21. Testlar va qabul qilish holati

Oxirgi funksional commitda `npm run check`, `npm test`, `npm run build` va
`git diff --check` muvaffaqiyatli o‘tgan. `npm test` to‘qqizta `.test.mjs`
faylini ishga tushiradi; ichida ko‘p alohida testlar mavjud. `management.test.mjs`
oxirgi katta qo‘shimcha uchun 12ta ssenariyni qamrab oladi.

| Test fayli | Asosiy himoyalanadigan xulq |
| --- | --- |
| `accounting.test.mjs` | FIFO, sotuvchi/ega, qoldiq, qaytarish, eski helperlar |
| `business.test.mjs` | Nasiya, pul, ijara, vaqt chegaralari, nuqson, bo‘sh state |
| `negotiated-prices.test.mjs` | Haqiqiy narx, snapshot, ombor qiymati, kod bo‘yicha qidiruv |
| `inventory-entry.test.mjs` | Guruhlab kirim, limit, ruxsatlar, invalid qator atomarligi |
| `catalog.test.mjs` | S/A/Note, Plus/Ultra/Pro/PM, filtr va guruh farqlari |
| `admin.test.mjs` | Ismlar, rollar, konfiguratsiya, ruxsatlar, owner almashish |
| `corrections.test.mjs` | Reversal, qarz/ijara/personal pul, kun yakuni, backup validatsiya |
| `management.test.mjs` | Xizmat, CRUD, arxiv, sale/flow/debt/purchase/closing/defect/rent tuzatishi |
| `themes.test.mjs` | Theme persistence va fallback, biznes ma’lumotini o‘zgartirmaslik |

Oxirgi UI tekshiruvida:

- 390×844 telefon o‘lchamida xizmat kiritish/tahrirlash, tasdiq oynasi va mobil
  bo‘limlar ishlagan; sahifa kengligi tashqariga chiqmagan.
- Boybekning 50 000lik sinov xizmati tahrirlanib 60 000 bo‘lganda umumiy foydada
  faqat 60 000 qolgan; Asilbekning shaxsiy xizmatlarida u ko‘rinmagan.
- Asilbek sinov qarzdorini ko‘rib, 100 000dan 30 000 to‘lov olganda qoldiq 70 000
  bo‘lgan; umumiy sahifa shu zahoti yangilangan.
- Mahsulot qo‘shish va nomini tahrirlash mobil ro‘yxat va umumiy sahifada ishlagan.
- Otabekning yangilangan admin paneli ommaviy saytda ochib ko‘rilgan.

Bu sonlar **faqat alohida localhost:4176 QA ma’lumotlari** bo‘lgan; kodga seed
qilinmagan va public demoga kiritilmagan. Shu localhostda o‘sha brauzer profili
qayta ishlatilsa mahalliy QA yozuvlari qolgan bo‘lishi mumkin; bu demo ishlab
chiqarishda seed bor degani emas.

To‘g‘ri test muhiti: yangi alohida localhost port/origin, synthetic yozuvlar.
Mavjud ochiq sayt yoki foydalanuvchi ishlatadigan localhost xotirasini test uchun
reset qilmang. Private backupni ommaviy fixturega aylantirmang. Kod o‘zgarsa
tegishli hisob regressiyalari va telefon oqimini tekshiring; faqat hujjat
tahriri uchun yangi sun’iy biznes testlar yozish shart emas.

Moliyaviy chegaralar o‘zgartirilsa minimal regressiyalar:

1. Nasiya savdo va keyingi to‘lov bir marta daromad hisoblaydi.
2. Refund haqiqiy olingan pul va asl FIFO lotlarini qaytaradi.
3. Personal xarajat va keyingi reimbursement foydadan ikki marta ayrilmaydi.
4. Ijara belgilash va uni to‘lash ikki marta xarajatga aylanmaydi.
5. Service edit/delete foyda va xodim attributionini buzmaydi, cash yaratmaydi.
6. Chek/kirim/nuqson/sanoq tuzatishi xatoda qisman state qoldirmaydi.
7. Save/load/restoredan keyin havolalar va jami summalar mos qoladi.
8. Ruxsatsiz UI amalini domain funksiyani bevosita chaqirib ham qilib bo‘lmaydi.

Testlar yo‘qligi yoki o‘tishi haqiqiy server xavfsizligi va barcha mumkin bo‘lgan
moliyaviy holatlarda production tayyorligi haqida kafolat emas.

## 22. GitHub va demo nashri

GitHub `main` oxirgi funksional commit bilan sinxronlangan. Hujjat qo‘shilgach
uning commitini ham push qilish kerak. Odatdagi Git SSH orqali push shu
muhitda muvaffaqiyatli ishlagan. API connector ruxsatini kengaytirish yoki yangi
GitHub integratsiyasini o‘rnatish shart bo‘lmagan.

Foydalanuvchi: **har bir tugallangan o‘zgarishni GitHub’ga yuklab boring** deb
doimiy topshiriq bergan. Buni davom ettiring; `git status`ni tekshiring, begona
o‘zgarishlarni aralashtirmang, force-push yoki destruktiv reset qilmang. Umidjonning
`.obsidian/` kabi shaxsiy fayllari ham shu ish papkasida uchragan; ular source
deployga kiritilmagan. `.gitignore` va lokal exclude himoyasini chetlab o‘tmang.

Repo private JSON, `.env`, `.codex/`, `.agents/`, `.aws/`, `data/private/`,
`node_modules/`, `dist/` va `docs/*.png`ni commitdan chiqaradi. Git ignore backup
fayllarining ayrim nomlarini ham chiqaradi. Haqiqiy foydalanuvchi ma’lumoti
faylini nomi boshqacha bo‘lsa ham qo‘shish mumkin degani emas.

Hozir demo **Sites**da. Manifest:

```json
{
  "project_id": "appgprj_6af2fab67a708191bbec6b01bce6eb3d",
  "static": { "directory": "dist" }
}
```

Oxirgi funksional nashr **6-versiya**, deploy holati `succeeded`, manbasi yuqorida
berilgan `cfd201c...` commit. To‘liq saqlangan version ID:

```text
appgprj_6af2fab67a708191bbec6b01bce6eb3d~appgver_3cd7e61e34808191be8fc05c4835769e
```

`GitHub push` va `demo deploy` alohida amallar. GitHub uchun hosting workflow
sozlangan deb o‘ylamang. GitHub Pages/Vercel/Netlifyga avtomatik bog‘langanligi
repozitoriydan tasdiqlanmagan. `dist/` statik hostga yaroqli, ammo mavjud Sites
URLini oddiy SSH push bilan yangilab bo‘lmaydi.

Sites vositalari bo‘lsa mavjud project ID va joriy auditoriyani saqlab ishlang:
manbani Sites source repoga sinxronlash, aynan o‘sha commitdan dist arxiv,
save version, keyin deploy. Source repo va GitHub remote bir xil narsa emas.
Token/credentiallarni shell argumenti, fayl, git yoki hujjatga yozmang.

Claude muhitida Sites vositalari bo‘lmasa GitHub pushni bajaring va demo hali
yangilanmaganini aniq ayting. «Yukladim» deb faqat build yaratishni nazarda
tutmang. Boshqa hostga ko‘chirish foydalanuvchi bilan alohida kelishiladi.

Ushbu topshirish hujjati source dokumentatsiyasi. U buildga kirmaydi, shuning
uchun uning o‘zigina o‘zgarganda UI demo deployi zarur emas.

## 23. Tavsiya etiladigan davom ettirish tartibi

Keyingi topshiriqqa qarab ish olib boring. Backendni foydalanuvchi so‘rasa:

1. Hozirgi funksional holat va shaxsiy ma’lumotni saqlash yo‘lini tekshiring.
2. Login, API va DB tanlovini budjet/hosting bilan moslang. UI rol selectini
   haqiqiy auth deb qabul qilmang; server har amalda vakolatni tekshirsin.
3. Birinchi vertikal oqimni tugating: login → katalog/qoldiq → sotuv → to‘lov/qarz
   → umumiy va xodim hisobotlari. Moliyaviy invariantlar testlari saqlansin.
4. Offline uchun faqat `operations[]`ni yuborish yetmaydi. To‘liq payloadli
   persistent outbox, idempotency, server tranzaksiyasi va ack/retry kerak.
5. Parallel sotuvlar, UUID/chek raqami/SKU, manfiy qoldiq va konflikt uchun
   aniq biznes oqimini belgilang. Pul/qarz yozuvini oddiy last-write-wins
   bilan birlashtirmang.
6. Keyin server backup, audit, qarz muddati scheduleri va telefon bildirishnomasi.
7. Real ishlatishdan oldin bir nechta qurilmada, internet uzilishida, qayta ochishda
   va duplicate requestlarda hisob mosligini tekshiring.

Yangi UI topshirig‘i bo‘lsa shu bosqichlarni aralashtirmay hozirgi frontendda
kerakli o‘zgarishni qiling, tekshiring va GitHub’ga yuklang. Tayyor imkoniyatni
yangi nom ostida qayta qurishdan oldin koddagi mavjud oqimni o‘qing.

## 24. Foydalanuvchi bilan ishlash uslubi

- O‘zbekcha, sodda va qisqa tushuntiring; murakkab ichki texnik detallarni
  do‘konning ish ekraniga olib chiqmang.
- Foydalanuvchi oldin vaziyatni yaxshilab tushunish uchun savol so‘rashni
  aytgan. Shuning uchun kelishilmagan muhim biznes qoidasini taxmin qilmang,
  lekin allaqachon javobi bor savollarni qayta bermang.
- U «davom ettir» desa faqat reja bilan to‘xtamang. Ruxsatli ishni tugating,
  tekshiring, GitHub’ga yuklang va natijani ko‘rsating.
- U do‘sti bilan ko‘rib yangi talab berishi mumkin. Eng oxirgi talabga moslang,
  oldingi qarama-qarshi taklifni jimgina qayta kiritmang.
- Bo‘sh namuna bilan ishlash haqidagi oldingi talabni real ma’lumotlarni har
  safar o‘chirishga ruxsat deb olmang.
- Nima tayyor, nima demo, nima hali ulanmaganini ochiq ayting. Ayniqsa login,
  sinxronlash, telefon xabari va moliyaviy hisobni haddan tashqari va’da qilmang.

## 25. Claude Code uchun tayyor boshlash xabari

Quyidagi matnni loyiha papkasida ochilgan Claude Code chatiga yuborish mumkin:

```text
TelefonZona loyihasini Codexdan davom ettiryapman. Avval CLAUDE.md va
docs/CLAUDE_HANDOFF.md ni to‘liq o‘qi, keyin tegishli source va testlarni tekshir.
Ularda oldingi suhbatdagi maqsad, kelishilgan qoidalar, hozirgi imkoniyatlar,
ma’lumot shakli, cheklovlar va deploy haqida kontekst bor.

Mavjud real ma’lumotlarni tozalama, v2 localStorage kalitini almashtirma, eski
tashqi JSONni import qilma. Hozir frontend demo borligini va haqiqiy login/sync
hali yo‘qligini hisobga ol. Uchta profil, bitta kassa, sotuvchi va mahsulot egasi
alohida. Mobil interfeys va to‘rtta mavzuni saqla. Tugallangan o‘zgarishlarni
GitHub’ga yuklab bor.

Avval tushunganingni, tayyor imkoniyatlarni va asosiy qolgan ishlarni qisqa
ayt. Hali yangi topshiriq bermagan bo‘lsam o‘zingcha katta refaktor yoki backend
qurishni boshlama; keyingi topshirig‘im bo‘yicha davom etamiz.
```
