import { config, validateConfig } from './config.js';
import NamecheapAPI from './namecheap.js';
import InstaWPAPI from './instawp.js';
import CloudflareAPI from './cloudflare.js';

async function testNamecheap() {
  console.log('\n=== Testing Namecheap API ===\n');

  const namecheap = new NamecheapAPI();

  try {
    // Test 1: Check domain availability
    console.log('Test 1: Checking domain availability...');
    const testDomain = 'example-test-123456789.com';
    const result = await namecheap.checkDomain(testDomain);

    console.log('✅ Domain check successful!');
    console.log(`   Domain: ${result.domain}`);
    console.log(`   Available: ${result.available}`);
    console.log(`   Premium: ${result.premium}`);

  } catch (error) {
    console.error('❌ Namecheap test failed:', error.message);
    throw error;
  }
}

async function testInstaWP() {
  console.log('\n=== Testing InstaWP API ===\n');

  const instawp = new InstaWPAPI();

  try {
    // Test 1: List templates
    console.log('Test 1: Listing templates...');
    const templates = await instawp.listTemplates(1, 10);

    console.log(`✅ Found ${templates.length} templates`);

    if (templates.length > 0) {
      console.log('\nFirst 5 templates:');
      templates.slice(0, 5).forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.name} (slug: ${t.slug})`);
      });
    }

    // Test 2: Find specific template
    console.log('\nTest 2: Finding template...');
    const templateSlug = config.instawp.templateSlug;

    try {
      const template = await instawp.findTemplateBySlug(templateSlug);
      console.log(`✅ Found template: ${template.name}`);
      console.log(`   Slug: ${template.slug}`);
      console.log(`   ID: ${template.id}`);
    } catch (error) {
      console.log(`⚠️  Template '${templateSlug}' not found. Available templates:`);
      templates.slice(0, 10).forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.name} (slug: ${t.slug})`);
      });
    }

  } catch (error) {
    console.error('❌ InstaWP test failed:', error.message);
    throw error;
  }
}

async function testCloudflare() {
  console.log('\n=== Testing Cloudflare API ===\n');

  if (!config.cloudflare.apiKey) {
    console.log('⚠️  Cloudflare not configured (CLOUDFLARE_API_KEY not set)');
    console.log('   To test Cloudflare, add CLOUDFLARE_API_KEY in .env');
    return;
  }

  const cloudflare = new CloudflareAPI();

  try {
    // Test 1: List zones
    console.log('Test 1: Listing Cloudflare zones...');
    const zones = await cloudflare.listZones();

    console.log(`✅ Found ${zones.length} zone(s)`);

    if (zones.length > 0) {
      console.log('\nExisting zones:');
      zones.forEach((z, i) => {
        console.log(`   ${i + 1}. ${z.name} (ID: ${z.id})`);
      });
    } else {
      console.log('   No existing zones found.');
    }

  } catch (error) {
    console.error('❌ Cloudflare test failed:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('\n========================================');
  console.log('API Integration Tests');
  console.log('========================================');

  try {
    // Validate configuration
    console.log('\n=== Validating Configuration ===\n');
    validateConfig();
    console.log('✅ Configuration valid!');

    // Test Namecheap
    await testNamecheap();

    // Test InstaWP
    await testInstaWP();

    // Test Cloudflare (if enabled)
    await testCloudflare();

    console.log('\n========================================');
    console.log('✅ All tests passed!');
    console.log('========================================\n');

  } catch (error) {
    console.log('\n========================================');
    console.log('❌ Tests failed!');
    console.log('========================================\n');
    console.error(error);
    process.exit(1);
  }
}

runTests();
