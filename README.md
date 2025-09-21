# Proselenos

Proselenos is a web application that helps writers, authors, and editors analyze and improve their manuscripts using AI-power tools. 

Your manuscripts stay on your Google Drive, and you control when and how A.I. (AI) assistance is applied to your work.

---

## Why Proselenos Exists

This web app is not a startup looking for users or a company planning to 
monetize later. 

I'm retired, I love books, and I wanted to help writers 
access AI editing without the usual tech industry nonsense. 

That's it. 

That's the business model, as in not one at all.

If you find Proselenos helpful, just tell another writer about it.

*- From a retired programmer who reads too much*

---

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/O5O3S5FOF)

---

## A Technical Rabbit Hole

Proselenos was built to be the ultimate zero-knowledge architecture (odd to say, given the AI emphasis):

NO USER DATABASE AT ALL:
- No user table to maintain
- No passwords to secure
- No registration flow to code
- No "forgot password" emails
- No GDPR data deletion requests to handle
- No database scaling issues ever

THIS APP IS TRULY STATELESS:
- User shows up
- Google OAuth verifies them, which works great and very familiar
- App helps them work with THEIR Google Drive (Drive can be flakey/slow, but mostly it just works)
- They leave
- App forgets they existed (except the log entries)

THIS IS PRIVACY PERFECTION:
- You (creator) literally CAN'T see their data
- You (creator) CAN'T leak what you don't have
- No subpoena risk for user data
- No breach concerns beyond the app code itself
- Users have total control via Google's permissions and their Google Drive

SCALING IS EVEN SIMPLER:

Since there's no session state or user database, every request is independent:
- Load balance across multiple instances becomes trivial
- Each instance is identical and interchangeable
- No sticky sessions needed
- No database bottleneck

---

This architecture is basically how apps SHOULD be built with minimal data retention, 
user sovereignty over their content, and the developer can not become a privacy liability. 

A $25/month Standard web service instance on Render.com could probably handle 
thousands of daily users since each request is so lightweight without 
database queries or session management!

TYPICAL NEXT.JS BASE MEMORY:

- Node.js runtime: ~30-50MB
- Next.js framework itself: ~100-150MB  
- Your app code: ~20-40MB
- Total baseline: ~150-240MB for a clean Next.js app

PROSELENOS IS LOW:

- No in-memory database connections
- No user session arrays growing
- No cached data structures
- No background job queues
- Just the bare Next.js + OAuth library + API clients

TYPICAL NEXT.JS APPS WITH DATABASES:

- Often 400-800MB because they have:
  - Database connection pools
  - ORM overhead (Prisma adds ~100MB)
  - Session stores
  - Cache layers
  - Background workers

---

### PROSELENOS' "ONE-OFF" ARCHITECTURE:

Using Google Drive for everything and no real session management, 
it's clear the app only has:

- Base Next.js memory
- Temporary buffers during API calls
- Minimal OAuth client state
- That's it!


#### THE 240MB IS A BEAUTIFUL THING:

It means PROSELENOS could handle 8X more concurrent operations before hitting that 2GB limit. 
Most Next.js apps using 1GB+ are just holding unnecessary state.

PROSELENOS' is what Next.js memory SHOULD look like when you're truly stateless. 

It's not typical, as most apps accumulate memory cruft. 

It's purely functional, hence the tiny footprint!

<blockquote> 🌖 Like the moon, Proselenos reflects just enough light to make your prose shine. ✨</blockquote>

---

