# Daily Hisab — দৈনিক বাজার হিসাব

পরিবার ও ব্যবসার দৈনিক খরচ (বাজার/কেনাকাটা) হিসাব রাখার সম্পূর্ণ বাংলা ওয়েব অ্যাপ্লিকেশন।
React ফ্রন্টএন্ড + Node.js API + PostgreSQL ডেটাবেস, রোল-ভিত্তিক লগইন, বাংলা সংখ্যা/তারিখ,
চার্টসহ ড্যাশবোর্ড, মাসিক/বার্ষিক রিপোর্ট, PDF ও Excel ডাউনলোড এবং Android APK।

## মূল ফিচার

- দৈনিক খরচ এন্ট্রি: পণ্যের নাম (আগের নামের ড্রপডাউন-সাজেশন, টাইপ করলেই প্রথম মিল অটো-নির্বাচিত), পরিমাণ, একক, একক দাম, মোট (স্বয়ংক্রিয় হিসাব)
- **একসাথে অনেক হিসাব:** এক ফর্মে একাধিক সারি যোগ করে সবগুলো একবারে সংরক্ষণ (একই তারিখ/ধরন, সারি প্রতি ক্যাটাগরি/একক)
- পরিবার (family) ও ব্যবসা (business) — আলাদা স্কোপে হিসাব
- তারিখ-ভিত্তিক ফিল্টার, সার্চ, এডিট, ডিলিট
- ড্যাশবোর্ড: মোট খরচ, রেকর্ড সংখ্যা, দৈনিক গড়, ক্যাটাগরি/স্কোপ/মাসিক চার্ট
- মাসিক ও বার্ষিক রিপোর্ট + PDF ও Excel ডাউনলোড
- রোল: Super Admin, Manager, Employee, Family
  - Super Admin: সব ইউজার তৈরি/নিষ্ক্রিয়/পারমিশন, সব লেনদেন দেখা/এডিট/ডিলিট
  - Manager: সব খরচ ও রিপোর্ট দেখা
  - Employee/Family: নিজের রেকর্ড (Family শুধু নিজের family স্কোপ)
  - **আইডি খোলার অনুমতি:** অ্যাডমিন প্যানেল থেকে কোনো ব্যবহারকারীকে অনুমতি দিলে সে নিজে নতুন
    পারিবারিক/কর্মচারী আইডি খুলতে পারে (সাইডবারে "নতুন আইডি" অপশন)
- সম্পূর্ণ রেসপন্সিভ (মোবাইল / ট্যাবলেট / ডেস্কটপ), সবুজ-সাদা থিম
- Android WebView অ্যাপ — সাইটের ভেতর থেকেই APK ডাউনলোড লিংক

## টেক স্ট্যাক

| স্তর | প্রযুক্তি |
| --- | --- |
| ফ্রন্টএন্ড | React 18, Vite 5, react-router, recharts, jspdf, html2canvas, xlsx |
| ব্যাকএন্ড | Node.js, Express 4, pg, bcryptjs (cost 12), JWT (httpOnly cookie), helmet, rate-limit |
| ডেটাবেস | PostgreSQL (লোকালে embedded-postgres, ক্লাউডে ম্যানেজড Postgres) |
| Android | Java WebView wrapper (Gradle) |

## লোকাল রান (এই কম্পিউটারে)

Node ও PostgreSQL সিস্টেমে ইনস্টল না থাকলেও চলবে — `.tools/node` পোর্টেবল Node এবং
`embedded-postgres` ব্যবহার করা হচ্ছে।

```bat
rem ১) ডেটাবেস চালু (পোর্ট 5433)
data\start-db.bat

rem ২) সার্ভার চালু (পোর্ট 3100) — বিল্ড করা ক্লায়েন্ট সহ
npm start

rem ৩) (ঐচ্ছিক) ইন্টারনেটে শেয়ার — Cloudflare quick tunnel
data\start-tunnel.bat
```

- ওয়েবসাইট: http://localhost:3100
- ডেভেলপমেন্ট মোড (Vite HMR): `npm run dev` + `npm run client` (Vite পোর্ট 5173, `/api` প্রক্সি 3100-এ)
- প্রথমবারে `.env` তৈরি করুন `.env.example` থেকে, তারপর `npm run db:init`
- ডেমো ডেটা: `npm run seed:demo`

### ডিফল্ট অ্যাডমিন

- ইমেইল: `admin@dailyhisab.com`
- পাসওয়ার্ড: `Admin@12345` (`.env`-এর `ADMIN_PASSWORD`)
- ডেমো ইউজার (seed চালালে): manager/employee/family অ্যাকাউন্ট

## পাবলিক লিংক (এই মুহূর্তে চালু)

- ওয়েবসাইট: https://committed-kissing-planner-bookmark.trycloudflare.com
- APK ডাউনলোড: https://committed-kissing-planner-bookmark.trycloudflare.com/Daily-Hisab.apk

> ⚠️ এটি Cloudflare **quick tunnel** — কম্পিউটার/টানেল বন্ধ বা রিস্টার্ট হলে লিংক বদলে যায়।
> টানেল চালু করতে: `data\start-tunnel.bat` (নতুন লিংক `data\cloudflared.log`-এ থাকবে, অ্যাপের ভেতরের
> সেটিংস থেকেও সার্ভার ঠিকানা বদলানো যায়)। স্থায়ী লিংকের জন্য নিচের Render/Neon নির্দেশনা অনুসরণ করুন।

## Android APK

- ডাউনলোড: `/Daily-Hisab.apk` (সাইটের ভেতরে লিংক আছে)
- বিল্ড করা ফাইল: `android/app/build/outputs/apk/debug/app-debug.apk`

পুনরায় বিল্ড:

```bat
cd android
gradlew.bat assembleDebug -PDAILYHISAB_SERVER_URL="https://আপনার-ডোমেইন"
```

`app/build.gradle`-এর `DAILYHISAB_SERVER_URL` ডিফল্ট সাইটের ঠিকানা; অ্যাপের ভেতরে
সেটিংস থেকে যেকোনো সময় সার্ভার ঠিকানা বদলানো যায় (শুধু http/https, একই origin লোড হয়)।

## স্থায়ী ডিপ্লয়মেন্ট (Render + ম্যানেজড Postgres)

রিপোতে `render.yaml` দেওয়া আছে — Render Dashboard → **New → Blueprint** দিয়ে রিপো কানেক্ট করলেই
ওয়েব সার্ভিস + PostgreSQL তৈরি হবে (`daily-hisab` / `daily-hisab-db`)।

আবশ্যক এনভায়রনমেন্ট ভেরিয়েবল:

| ভেরিয়েবল | অর্থ |
| --- | --- |
| `DATABASE_URL` | Postgres কানেকশন স্ট্রিং (Render ডেটাবেস থেকে অটো) |
| `JWT_SECRET` | লম্বা র‍্যান্ডম সিক্রেট (`render.yaml` অটো-জেনারেট করে) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | প্রথম Super Admin (ডেটাবেস খালি থাকলে তৈরি হয়) |
| `COOKIE_SECURE` | প্রোডাকশনে `true` (HTTPS-only কুকি) |
| `PORT` | হোস্টিং প্ল্যাটফর্ম দিলে সেটাই ব্যবহার হয় |

Neon/অন্য Postgres ব্যবহার করলে: `DATABASE_URL` বসান (`?sslmode=require` সহ), `PGSSL=false` না দিলে
SSL স্বয়ংক্রিয়ভাবে চালু হয়। সার্ভার চালু হওয়ার সময় স্কিমা ও Super Admin স্বয়ংক্রিয়ভাবে তৈরি হয়
(`server/bootstrap.js`) — আলাদা মাইগ্রেশন কমান্ড লাগে না।

Docker চাইলে: `Dockerfile` (multi-stage) বিল্ড করেই ডিপ্লয় করা যায়।

## গুরুত্বপূর্ণ ফাইল

```
server/            API, auth, routes, schema.sql, bootstrap
client/            React অ্যাপ (src/pages, components, styles.css)
android/           Android WebView অ্যাপ, Daily Hisab আইকন
scripts/           dev-db.js (embedded Postgres), seed-demo.js
data/              লোকাল DB ডেটা, start-db.bat, start-server.bat, start-tunnel.bat (gitignored)
render.yaml        Render Blueprint (ওয়েব + DB)
Dockerfile         কন্টেইনার বিল্ড
```

## মালিকানা

সম্পূর্ণ সোর্স কোড ও ডেটাবেস স্কিমা আপনার। ক্লাউড ডেটাবেস (Render/Neon) আপনার অ্যাকাউন্টে তৈরি হয়,
তাই ডেটার মালিকও আপনি — ব্যাকআপ, এক্সপোর্ট ও অ্যাক্সেস সম্পূর্ণ আপনার নিয়ন্ত্রণে।
