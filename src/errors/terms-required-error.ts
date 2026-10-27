export class TermsRequiredError extends Error {
  constructor() {
    super('Termos de uso não aceitos.')
  }
}
