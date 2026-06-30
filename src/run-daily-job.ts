import BillingService from "./services/billing-service";
import LicenseService from "./services/license-service";
import JobsService from "./services/jobs-service";

async function main() {
  const billingService = new BillingService();
  const licenseService = new LicenseService();
  const jobs = new JobsService({ billingService, licenseService });
  const result = await jobs.runDaily();
  console.log("[daily-job]", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[daily-job] failed:", err);
    process.exit(1);
  });
