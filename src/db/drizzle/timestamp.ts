import { customType } from "drizzle-orm/pg-core";
import { DateTime } from "luxon";

const isoTimestamp = customType<{ data: string; driverData: string }>({
  dataType: () => "timestamp with time zone",
  fromDriver: (value) => DateTime.fromSQL(value, { zone: "utc" }).toISO() ?? value,
  toDriver: (value) => value,
});

export const tstz = (name: string) => isoTimestamp(name);
