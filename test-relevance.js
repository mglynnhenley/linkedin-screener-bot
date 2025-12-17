import dotenv from 'dotenv';
dotenv.config();

const testUrls = [
  'https://linkedin.com/in/anna-kostromina',
  'https://linkedin.com/in/avikukshal',
];

async function testRelevanceAPI() {
  console.log('=== Testing Relevance API ===\n');
  console.log('RELEVANCE_API_URL:', process.env.RELEVANCE_API_URL ? '✅ Set' : '❌ Not set');
  console.log('URL value:', process.env.RELEVANCE_API_URL || '(empty)');
  console.log('\nTest URLs:', testUrls);
  console.log('\nRequest body:', JSON.stringify({ profile_urls: testUrls }, null, 2));
  
  try {
    console.log('\n--- Making request... ---\n');
    
    const response = await fetch(process.env.RELEVANCE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_urls: testUrls }),
    });
    
    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const rawText = await response.text();
    console.log('\n--- Raw response text ---');
    console.log(rawText);
    console.log('--- End raw response ---\n');
    
    // Try to parse as JSON
    try {
      const data = JSON.parse(rawText);
      console.log('Parsed JSON:');
      console.log(JSON.stringify(data, null, 2));
      
      // Check structure
      console.log('\n--- Response structure analysis ---');
      console.log('Type:', typeof data);
      console.log('Is array:', Array.isArray(data));
      console.log('Keys:', Object.keys(data));
      if (data.results) console.log('Has results:', data.results);
      if (data.data) console.log('Has data:', data.data);
      if (data.output) console.log('Has output:', data.output);
    } catch (parseErr) {
      console.log('Failed to parse as JSON:', parseErr.message);
    }
    
  } catch (error) {
    console.error('Request failed:', error.message);
    console.error('Full error:', error);
  }
}

testRelevanceAPI();

