import { DataImport } from "./DataImport";

export function DataCleaning({ onProcessed }: { onProcessed?: () => void }) {
  return <DataImport refreshToken={0} onChanged={onProcessed} />;
}
