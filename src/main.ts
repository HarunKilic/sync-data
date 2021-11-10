import {
  difference as _difference,
  intersection as _intersection,
  map as _map,
} from "lodash";

type StatusType = {
  success: number;
  errors: string[];
};

export type SyncStatusResult = {
  created: StatusType;
  updated: StatusType;
  removed: StatusType;
};

export type SyncProps<A, B> = {
  to: {
    data: A[];
    uniqueId: keyof A;
  };
  from: {
    data: B[];
    uniqueId: keyof B;
  };
  create: (item: B) => Promise<boolean>;
  update: (index: number, originalItem: A, newItem: B) => Promise<boolean>;
  isDifferent: (originalItem: A, newItem: B) => boolean;
  remove: (index: number, item: A) => Promise<boolean>;
  onFinish?: (params: FinishParams) => void;
  onStart?: () => Promise<void>;
  collectionName?: string;
};

export type FinishParams = {
  errors?: string[];
  results?: SyncStatusResult;
};

export async function sync<A, B>({
  to,
  from,
  remove,
  update,
  isDifferent,
  create,
  collectionName,
  onFinish,
  onStart,
}: SyncProps<A, B>): Promise<SyncStatusResult> {
  onStart && (await onStart());
  const a: any = formatArray(to.uniqueId, to.data);
  const aIds = _map(a, to.uniqueId as string);

  const b: any = formatArray(from.uniqueId, from.data);
  const bIds = _map(b, from.uniqueId as string);
  // Origin Has but New Doesn't
  const c = _difference(aIds, bIds);
  // Both has
  const d = _intersection(aIds, bIds);
  // New Has but Original Doesn't
  const e = _difference(bIds, d);

  const status: SyncStatusResult = {
    created: {
      success: 0,
      errors: [],
    },
    updated: {
      success: 0,
      errors: [],
    },
    removed: {
      success: 0,
      errors: [],
    },
  };

  console.log("REMOVING", collectionName);
  for (const index of c) {
    try {
      const removed = await remove(index, a[index]);
      if (removed) status.removed.success++;
    } catch (error) {
      status.removed.errors.push((error as Error).message);
    }
  }

  console.log("UPDATING", collectionName);
  for (const index of d) {
    if (isDifferent(a[index], b[index])) {
      try {
        const updated = await update(index, a[index], b[index]);
        if (updated) status.updated.success++;
      } catch (error) {
        status.updated.errors.push((error as Error).message);
      }
    }
  }

  console.log("CREATING", collectionName);

  for (const index of e) {
    try {
      const createItem = await create(b[index]);

      if (createItem) status.created.success++;
    } catch (error) {
      status.created.errors.push((error as Error).message);
    }
  }

  onFinish && onFinish({ errors: undefined, results: status });

  return status;
}

function formatArray<T>(uniqueId: keyof T, array: T[]): T {
  const hash: T = {} as T;

  array.forEach((item) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    hash[item[uniqueId]] = item;
  });

  return hash;
}
