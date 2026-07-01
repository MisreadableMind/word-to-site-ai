import BillingService from "./services/billing-service";
import LicenseService from "./services/license-service";
import BuyoutService from "./services/buyout-service";
import JobsService from "./services/jobs-service";

async function main() {
  const licenseService = new LicenseService();
  const buyoutService = new BuyoutService();
  const billingService = new BillingService({ licenseService, buyoutService });
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
