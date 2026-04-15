import InstaWPAPI from './instawp.js';

const api = new InstaWPAPI();

// Try listing templates with different team IDs
const teamIds = [132228, 1179, 81031, 72884, 32367, null];

for (const teamId of teamIds) {
  try {
    const query = teamId
      ? `/templates?per_page=50&team_id=${teamId}`
      : '/templates?per_page=50';
    console.log(`\n--- Fetching templates: ${teamId ? `team_id=${teamId}` : 'no team filter'} ---`);
    const response = await api.makeRequest(query);
    const templates = response.data || [];
    console.log(`Found ${templates.length} templates:`);
    templates.forEach(t => {
      console.log(`  ID: ${t.id} | Slug: ${t.slug} | Name: ${t.name} | Team: ${t.team_id}`);
    });
  } catch (error) {
    console.error(`  Error: ${error.message}`);
  }
}
