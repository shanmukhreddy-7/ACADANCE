export type LoginDependencies = {
  challenge: () => Promise<{ id: string; suggestion: string | null }>;
  submit: (id: string, registration: string, password: string, code: string) => Promise<string>;
};
// The browser submits only credentials. Verification stays within this server flow.
export async function automaticLogin(
  registration: string,
  password: string,
  deps: LoginDependencies,
) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let verification: Awaited<ReturnType<LoginDependencies['challenge']>>;
    try {
      verification = await deps.challenge();
    } catch {
      throw Error('The university sign-in service is unavailable. Please try again shortly.');
    }
    if (!verification.suggestion) continue;
    try {
      return await deps.submit(verification.id, registration, password, verification.suggestion);
    } catch {
      throw Error(
        'Sign-in was not accepted. Check your registration number and password, then try again.',
      );
    }
  }
  throw Error('The university could not complete sign-in. Please try again shortly.');
}
