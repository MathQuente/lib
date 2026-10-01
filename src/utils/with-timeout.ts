export function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      value => {
        clearTimeout(timeoutId)
        resolve(value)
      },
      error => {
        clearTimeout(timeoutId)
        reject(error)
      }
    )
  })
}
