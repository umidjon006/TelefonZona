# TelefonZona Claude connector (MCP)

Holat sanasi: 2026-11-23. Server `/mcp` manzilida Model Context Protocol (Streamable HTTP)
beradi. Claude (claude.ai yoki Claude ilovasi) uni **custom connector** sifatida ulaydi va
do‘kon haqida savollarga javob beradi: «bugun qancha sotildi», «kimning qarzi muddati keldi»,
«S23U g‘ilofdan nechta bor», «Asilbek bugun nima kiritdi».

## Nima qila oladi va nima qila olmaydi

**Faqat o‘qiydi.** Hech bir vosita yozuvni o‘zgartirmaydi (testlar buni tekshiradi:
barcha vositalarni chaqirgandan keyin baza o‘zgarishsiz). Savdo kiritish, narx yoki ruxsat
o‘zgartirish connector orqali **mumkin emas**. Yozish vositalari alohida qaror va alohida
xavfsizlik ishi bo‘lardi (Claude xato tushunib moliyaviy yozuv kiritib yuborishi mumkin).

| Vosita | Kim uchun | Nima beradi |
| --- | --- | --- |
| `get_shop_summary` | Otabek: butun do‘kon; xodim: faqat o‘zi | Savdo, foyda, xarajat, ijara, kassa, qarz, ombor qiymati (Otabek); o‘z cheklari va xizmat foydasi (xodim) |
| `search_products` | hamma | Mahsulot guruhlari, qoldiq, narx oralig‘i; qisqa nomlar (S23U, iPhone 15PM). Tannarx faqat kirim ruxsati borlarga |
| `list_debts` | qarz ruxsati borlar | Ochiq qarzlar, telefon, muddat, qoldiq |
| `get_reminders` | hamma | Bugungi qarz eslatmalari, kirim topshiriqlari, xabarlar |
| `list_sales` | Otabek: hammasi + tannarx/foyda; xodim: faqat o‘ziniki | Cheklar |
| `list_receipt_tasks` | Otabek: hammasi; xodim: o‘zinikilari | Kirim topshiriqlari va bajarilishi |
| `who_entered_what` | Otabek: hammasi; xodim: o‘zi | Kim qaysi tovarni kiritgani |
| `get_cash_position` | faqat Otabek | Kassa, qarz, xodimga qarz, ijara, oxirgi kun yakuni |
| `staff_performance` | faqat Otabek | Xodimlar kesimida savdo va foyda |

## Xavfsizlik

- Connector **kim ruxsat bergan bo‘lsa, o‘sha shaxs** nomidan ishlaydi. Boybek ulasa, uning
  Claude’i Boybek ekranida ko‘rinadigan narsani ko‘radi, Otabek ko‘radigan hisobotlarni emas.
  Otabek ruxsatni o‘chirsa, connector ham o‘sha ma’lumotni ko‘rmay qoladi.
- Kirish OAuth 2.1 bilan: Claude sizni TelefonZona sahifasiga yuboradi, siz shaxsingizni
  tanlab odatdagi **parolingizni** shu sahifaga yozasiz (parol Claude’ga berilmaydi).
  PKCE (S256) majburiy; kod 10 daqiqa va faqat bir marta ishlaydi (noto‘g‘ri urinish ham uni
  yoqadi); access token 1 soat; refresh token 30 kun va har ishlatilganda almashadi, eskisi
  qayta kelsa shu ulanish butunlay o‘chiriladi.
- Parol xato kiritilsa umumiy bloklash (5 urinish, 15 daqiqa) ishlaydi.
- Qaytish manzillari faqat Claude (`claude.ai`, `claude.com`) va shu kompyuterdagi `localhost`.
  Boshqa sayt ro‘yxatdan o‘tolmaydi, kirish sahifasi boshqa saytga yo‘naltirmaydi.
- Parolni almashtirish yoki Otabek tiklashi shu shaxsning **barcha connectorlarini uzadi**.
- `/mcp` boshqa saytlardagi brauzer sahifalaridan (Origin) chaqirilmaydi.
- Tokenlar bazada faqat hash holida.
- Muhim: Claude’ga berilgan ma’lumot **Anthropic serverlariga** boradi (siz ulagan hisob
  siyosatiga ko‘ra). Mijoz telefonlari va summalar shunda Claude suhbatida bo‘ladi. Faqat o‘zingiz
  va ishonchli do‘stingiz uchun ulang. Ma’lumotdagi matnlar (ism, izoh) buyruq emas, ma’lumot
  deb belgilangan.

## Ulash (muhim shart: ommaviy HTTPS manzil)

Claude connectorni **Anthropic bulutidan** chaqiradi. Laptopdagi `127.0.0.1` yoki Wi-Fi
manzilingiz ularga ko‘rinmaydi. Demak kerak:

1. Serverga ommaviy `https://…` manzil (hosting yoki tunnel, `docs/BACKEND.md` «Telefonda sinash»).
2. Server shu manzilni bilishi uchun:

```sh
TZ_PUBLIC_URL=https://sizning-manzil.example TZ_COOKIE_SECURE=1 TZ_TRUST_PROXY=1 npm run server
```

3. Claude’da: Sozlamalar → Connectors → **Add custom connector** → URL:
   `https://sizning-manzil.example/mcp` (ilova nomi: TelefonZona). Claude kirish sahifasini ochadi,
   shaxs va parolni kiritasiz, «Ruxsat berish».
4. Do‘stingiz o‘z Claude hisobida shu URL’ni qo‘shadi va **o‘z shaxsi** bilan kiradi
   (har kim o‘z parolini ishlatadi). Custom connector imkoniyati Claude tarifiga bog‘liq; hisobingizda
   ko‘rinmasa tarif shartlarini tekshiring.

Claude Desktop’ning mahalliy (stdio) ulanishi bu serverga kerak emas: u ham xuddi shu URL orqali ulanadi.

## Hali yo‘q / sinalmagan

- **Haqiqiy claude.ai bilan ulanish bu yerda sinalmagan.** Protokol va OAuth oqimi haqiqiy HTTP
  orqali avtomatik testlarda to‘liq tekshirilgan (ro‘yxatdan o‘tish, kirish, PKCE, token, MCP
  qo‘l siqish), lekin ommaviy manzil bo‘lmagani uchun Claude’ning o‘zi bilan sinab bo‘lmadi. Birinchi
  ulanishda kichik moslash kerak bo‘lishi mumkin.
- Yozish vositalari yo‘q (ataylab).
- Bitta `read` ruxsati: «faqat hisobotni» alohida ruxsat sifatida ajratib bo‘lmaydi.
- `TZ_PUBLIC_URL` o‘rnatilmasa manzil so‘rovdan olinadi (faqat sinash uchun); real joylashda majburiy deb hisoblang.
