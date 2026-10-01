export type BlockageSample = {
  executionAsyncId: number | null;
  capturedAtNs: bigint;
};

export default function (
  callback: (durationMs: number, stack: string | null, sample: BlockageSample) => void,
  options: {
    threshold: number;
    interval: number;
  },
): void;
