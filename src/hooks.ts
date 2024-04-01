import { useCallback, useRef } from 'react'

export function useStableFunction<Args extends unknown[], Res>(
  f: (...args: Args) => Res
): (...args: Args) => Res {
  const functionRef = useRef(f)
  functionRef.current = f

  return useCallback((...args: Args) => functionRef.current(...args), [])
}
