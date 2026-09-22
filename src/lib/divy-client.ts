import { queryOptions, useQueryClient } from "@tanstack/react-query";

import { getSnapshot } from "./divy.functions";

export const snapshotQuery = queryOptions({
  queryKey: ["divy", "snapshot"],
  queryFn: () => getSnapshot(),
  staleTime: 10_000,
});

export function useRefreshSnapshot() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["divy", "snapshot"] });
}
