import { NetworkStatus, type OperationVariables } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { toLocationInput } from '../../api/location';
import {
  IndoorRowDocument,
  OutdoorRowDocument,
  SkiingRowDocument,
  SurfingRowDocument,
  type ActivityResultFieldsFragment,
  type IndoorRowQuery,
} from '../../generated/graphql';
import type { Place } from '../../geocoding/geocoding';

export interface RowQuery<T> {
  /** undefined while the first request is open or after a failure. */
  data: T | undefined;
  failed: boolean;
  /** "Try again" is open. */
  retrying: boolean;
  retry: () => void;
}

export type ActivityQuery = RowQuery<ActivityResultFieldsFragment>;
export type IndoorQuery = RowQuery<IndoorRowQuery['activities']['indoor']>;

export interface RowQueries {
  /** true until all 4 queries settle (ui-spec.md, section 1). */
  waiting: boolean;
  skiing: ActivityQuery;
  surfing: ActivityQuery;
  outdoor: ActivityQuery;
  indoor: IndoorQuery;
}

/**
 * The 4 row queries, in parallel (architecture.md, section 3). Each row can
 * fail alone. "Try again" sends only the query of that row.
 */
export function useRowQueries(place: Place): RowQueries {
  const variables = { location: toLocationInput(place) };
  const skiing = useRow({ document: SkiingRowDocument, variables });
  const surfing = useRow({ document: SurfingRowDocument, variables });
  const outdoor = useRow({ document: OutdoorRowDocument, variables });
  const indoor = useRow({ document: IndoorRowDocument, variables });

  return {
    waiting: [skiing, surfing, outdoor, indoor].some((q) => q.waiting),
    skiing: rowQuery({ query: skiing, pick: (a) => a.skiing }),
    surfing: rowQuery({ query: surfing, pick: (a) => a.surfing }),
    outdoor: rowQuery({ query: outdoor, pick: (a) => a.outdoor }),
    indoor: rowQuery({ query: indoor, pick: (a) => a.indoor }),
  };
}

interface Row<TData> {
  data: TData | undefined;
  failed: boolean;
  waiting: boolean;
  retrying: boolean;
  retry: () => void;
}

function useRow<TData, TVariables extends OperationVariables>({
  document,
  variables,
}: {
  document: TypedDocumentNode<TData, TVariables>;
  variables: TVariables;
}): Row<TData> {
  const result = useQuery(document, {
    variables,
    notifyOnNetworkStatusChange: true,
  });
  const status = result.networkStatus;
  return {
    data: result.data as TData | undefined,
    failed: result.error !== undefined,
    waiting:
      status === NetworkStatus.loading || status === NetworkStatus.setVariables,
    retrying: status === NetworkStatus.refetch,
    // The error shows in `result.error`. Thus, the rejected promise is ignored.
    retry: () => void result.refetch().catch(() => undefined),
  };
}

function rowQuery<TData extends { activities: object }, T>({
  query,
  pick,
}: {
  query: Row<TData>;
  pick: (activities: TData['activities']) => T;
}): RowQuery<T> {
  return {
    data: query.data ? pick(query.data.activities) : undefined,
    failed: query.failed,
    retrying: query.retrying,
    retry: query.retry,
  };
}
