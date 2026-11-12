import { NextRequest, NextResponse } from 'next/server';
import { parsePortal } from '@/lib/portal-parser';
import {
  readSession,
  writeSession,
  sessionKey,
  sameOrigin,
  SESSION_COOKIE,
  cookieOptions,
  decrypt,
  type UniversitySession,
} from '@/server/session';
import { automaticLogin } from '@/server/automatic-login';
import { suggestCaptcha } from '@/server/captcha';
import { readState, mutateState } from '@/server/store';
import {
  pastInternals,
  todayAttendance,
  feedbackSubjects,
  feedbackForm,
  submitFeedback,
} from '@/server/portal-tools';
export const runtime = 'nodejs';
export const maxDuration = 60;
const BASE = 'https://student.srmap.edu.in/srmapstudentcorner';
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function upstream(path: string, id?: string, body?: URLSearchParams) {
  const response = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html, */*',
      Referer: BASE + '/HRDSystem',
      ...(id ? { Cookie: 'JSESSIONID=' + id } : {}),
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
    cache: 'no-store',
    signal: AbortSignal.timeout(22000),
  });
  if (!response.ok) throw Error('The university portal is unavailable. Try again shortly.');
  return response;
}
async function challenge(assist: boolean) {
  sessionKey();
  const initial = await upstream('/StudentLoginPage');
  const id = (initial.headers.get('set-cookie') ?? '').match(/JSESSIONID=([^;\s,]+)/)?.[1];
  if (!id) throw Error('The portal did not create a login session.');
  const image = await upstream('/captchas', id),
    type = image.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw Error('The portal did not return a CAPTCHA image.');
  const bytes = Buffer.from(await image.arrayBuffer());
  const settings = assist ? await readState().catch(() => null) : null;
  const suggestion =
    assist && settings?.captcha?.enabled !== false ? await suggestCaptcha(bytes) : null;
  if (assist)
    await mutateState((s) => {
      s.captcha ??= { enabled: true, requests: 0, suggestions: 0 };
      s.captcha.requests++;
      if (suggestion) s.captcha.suggestions++;
    }).catch(() => {});
  return {
    id,
    image: `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`,
    suggestion,
  };
}
async function login(id: string, registration: string, password: string, captcha: string) {
  const response = await upstream(
    '/StudentLoginToPortal',
    id,
    new URLSearchParams({ txtUserName: registration, txtAuthKey: password, ccode: captcha.trim() }),
  );
  const html = await response.text();
  if (!/<h2>/.test(html) && !html.includes('menu_toggle'))
    throw Error('Login was not accepted. Check your password and CAPTCHA, then refresh the image.');
  return (response.headers.get('set-cookie') ?? '').match(/JSESSIONID=([^;\s,]+)/)?.[1] ?? id;
}
export async function GET(req: NextRequest) {
  try {
    const result = await challenge(req.nextUrl.searchParams.get('assist') === '1');
    return writeSession(
      json({
        image: result.image,
        suggestion: result.suggestion,
        assistanceAvailable: !!result.suggestion,
      }),
      { id: result.id, authenticated: false, expires: Date.now() + 600000 },
    );
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : 'Could not connect to the university.' },
      503,
    );
  }
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = await req.json();
    let session = readSession(req);
    if (body.action === 'accounts') {
      const accounts = req.cookies
        .getAll()
        .filter((c) => c.name.startsWith('acadence_account_'))
        .flatMap((c) => {
          try {
            const value = decrypt<UniversitySession>(c.value);
            return value.expires > Date.now() && value.authenticated
              ? [{ registration: value.registration, remember: !!value.remember }]
              : [];
          } catch {
            return [];
          }
        });
      return json({ accounts });
    }
    if (body.action === 'activate') {
      const reg = String(body.registration ?? '').toUpperCase();
      if (!/^AP\d{8,15}$/.test(reg)) throw Error('Invalid account.');
      const value = req.cookies.get('acadence_account_' + reg)?.value;
      if (!value) throw Error('Sign in to this account again.');
      const account = decrypt<UniversitySession>(value);
      if (account.expires < Date.now()) throw Error('Sign in to this account again.');
      return writeSession(json({ success: true }), account);
    }
    if (body.action === 'logout') {
      const response = json({ success: true });
      response.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
      response.cookies.set('acadence_portal', '', { maxAge: 0, path: '/api/portal' });
      if (session?.registration)
        response.cookies.set('acadence_account_' + session.registration, '', cookieOptions(0));
      return response;
    }
    if (body.action === 'login-auto') {
      const registration = String(body.registration ?? '')
        .trim()
        .toUpperCase();
      if (
        !/^AP\d{8,15}$/.test(registration) ||
        typeof body.password !== 'string' ||
        !body.password ||
        body.password.length > 200
      )
        throw Error('Enter your registration number and password.');
      const saved = req.cookies
        .getAll()
        .filter((c) => c.name.startsWith('acadence_account_') && c.value);
      if (saved.length >= 5 && !saved.some((c) => c.name === 'acadence_account_' + registration))
        throw Error('Sign out of a saved account before adding another.');
      const id = await automaticLogin(registration, body.password, {
        challenge: () => challenge(true),
        submit: login,
      });
      return writeSession(json({ success: true }), {
        id,
        registration,
        authenticated: true,
        expires: Date.now() + 8 * 3600000,
      });
    }
    if (!session)
      return json({ error: 'Your session expired. Sign in again.', expired: true }, 401);
    if (body.action === 'login') {
      const reg = String(body.registration ?? '').toUpperCase();
      if (
        !/^AP\d{8,15}$/.test(reg) ||
        typeof body.password !== 'string' ||
        !body.password ||
        body.password.length > 200 ||
        typeof body.captcha !== 'string' ||
        !body.captcha.trim() ||
        body.captcha.length > 20
      )
        throw Error('Enter your registration number, password and CAPTCHA.');
      const accounts = req.cookies
        .getAll()
        .filter((c) => c.name.startsWith('acadence_account_') && c.value);
      if (accounts.length >= 5 && !accounts.some((c) => c.name === 'acadence_account_' + reg))
        throw Error('Sign out of one of your five saved accounts before adding another.');
      const id = await login(session.id, reg, body.password, body.captcha);
      const remember = body.remember === true;
      return writeSession(json({ success: true }), {
        id,
        authenticated: true,
        registration: reg,
        remember,
        password: remember ? body.password : undefined,
        expires: Date.now() + (remember ? 30 * 24 : 8) * 3600000,
      });
    }
    if (body.action === 'reset-initiate') {
      const registration = String(body.registration ?? '').toUpperCase();
      if (!/^AP\d{8,15}$/.test(registration) || !body.captcha)
        throw Error('Enter the registration number and CAPTCHA.');
      const response = await upstream(
        '/StudentPasswordResetInitiate',
        session.id,
        new URLSearchParams({
          txtUserName: registration,
          txtAuthKey: '',
          ccode: String(body.captcha),
        }),
      );
      const html = await response.text();
      if (!/<title>[^<]*Password Reset/i.test(html))
        throw Error(
          'The university did not confirm sending an OTP. Check the CAPTCHA or reset on the university portal.',
        );
      return json({
        success: true,
        message:
          'The university accepted the reset request. Check your registered contact for the OTP.',
      });
    }
    if (body.action === 'reset-complete') {
      if (
        !/^AP\d{8,15}$/i.test(String(body.registration)) ||
        typeof body.otp !== 'string' ||
        typeof body.password !== 'string' ||
        body.password.length < 8 ||
        body.password.length > 200
      )
        throw Error('Enter a valid registration number, OTP and new password.');
      const response = await upstream(
        '/usermanager/loginmanager/loginmanagerresources.jsp',
        session.id,
        new URLSearchParams({
          ids: '1',
          cpassword: body.password,
          txtUserName: String(body.registration).toUpperCase(),
          passwordotp: body.otp,
        }),
      );
      const result = await response.json();
      if (String(result.resultstatus) !== '1')
        throw Error('The university did not accept the OTP or password.');
      return json({ success: true, message: 'The university confirmed the password reset.' });
    }
    if (
      body.expectedRegistration &&
      session.registration &&
      body.expectedRegistration !== session.registration
    )
      return json({ error: 'Activate this university account before using portal tools.' }, 409);
    if (!session.authenticated)
      return json({ error: 'Sign in to the university first.', expired: true }, 401);
    const fetcher = (path: string, body: URLSearchParams) => upstream(path, session!.id, body);
    if (body.action === 'past-internals') {
      const semester = body.semester === undefined ? undefined : Number(body.semester);
      if (semester !== undefined && (!Number.isInteger(semester) || semester < 1 || semester > 20))
        throw Error('Invalid semester.');
      return json(await pastInternals(fetcher, semester));
    }
    if (body.action === 'today-attendance') return json(await todayAttendance(fetcher));
    if (body.action === 'feedback-subjects') return json(await feedbackSubjects(fetcher));
    if (body.action === 'feedback-form')
      return json(await feedbackForm(fetcher, String(body.subject)));
    if (body.action === 'feedback-submit') {
      if (body.confirmed !== true)
        throw Error('Review and confirm your answers before submitting.');
      return json(await submitFeedback(fetcher, String(body.subject), body.answers ?? {}));
    }
    if (body.action === 'attendance-code') {
      if (body.confirmed !== true) throw Error('Confirm your class attendance before submitting.');
      const code = String(body.code ?? '').trim();
      const latitude = Number(body.latitude),
        longitude = Number(body.longitude);
      if (
        !code ||
        code.length > 30 ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      )
        throw Error('Enter a code and allow your actual location.');
      const raw = await (
        await fetcher(
          '/students/transaction/studentattendanceresources.jsp',
          new URLSearchParams({
            ids: '1',
            acode: code,
            dynamiclatdata: String(latitude),
            dynamiclonxdata: String(longitude),
          }),
        )
      ).text();
      let result;
      try {
        result = JSON.parse(raw.replace(/<[^>]+>/g, '').trim());
      } catch {
        throw Error('No attendance confirmation returned. Check the portal before retrying.');
      }
      if (
        String(result.resultstatus) !== '1' &&
        !String(result.result).includes('Your Attendance captured al')
      )
        throw Error(String(result.result ?? 'Attendance code was not accepted.'));
      return json({
        success: true,
        message: String(result.result ?? 'Attendance captured successfully.'),
      });
    }
    if (body.action !== 'sync') return json({ error: 'Unknown portal action.' }, 400);
    async function fetchPages() {
      const sections = [
        ['attendance', '3'],
        ['profile', '1'],
        ['timetable', '10'],
        ['subjects', '2'],
        ['internals', '5'],
        ['ledger', '6'],
      ] as const;
      const results = await Promise.allSettled(
        sections.map(
          async ([name, id]) =>
            [
              name,
              await (
                await fetcher(
                  '/students/report/studentreportresources.jsp',
                  new URLSearchParams({ ids: id }),
                )
              ).text(),
            ] as const,
        ),
      );
      const pages: Record<string, string> = {};
      const warnings: string[] = [];
      let expired = false;
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const [name, html] = r.value;
          if (html.includes('txtAuthKey') || html.includes('StudentLoginPage')) {
            expired = true;
            warnings.push(name + ' needs a fresh login');
          } else pages[name] = html;
        } else warnings.push('Could not load ' + sections[i][0] + '. Try syncing again.');
      });
      return { pages, warnings, expired };
    }
    let loaded = await fetchPages();
    if (loaded.expired && session.remember && session.registration && session.password) {
      const next = await challenge(true);
      if (next.suggestion) {
        session = {
          ...session,
          id: await login(next.id, session.registration, session.password, next.suggestion),
        };
        loaded = await fetchPages();
      }
    }
    const data = parsePortal(loaded.pages);
    if (!data.attendance.length && !data.profile.registration)
      return json(
        {
          error: 'Your university session expired, or records were not returned. Sign in again.',
          expired: true,
        },
        401,
      );
    session = { ...session, registration: data.profile.registration || session.registration };
    return writeSession(
      json({ ...data, syncedAt: new Date().toISOString(), warnings: loaded.warnings }),
      session,
    );
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Portal request failed.' }, 400);
  }
}
