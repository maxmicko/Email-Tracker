// supabase-api.js
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

class SupabaseAPI {
  constructor() {
    this.url = process.env.SUPABASE_URL;
    this.key = process.env.SUPABASE_ANON_KEY;
    this.headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal' // Changed from representation to minimal
    };
  }

  async insert(table, data) {
    try {
      // Ensure ID is a valid UUID if not provided
      if (!data.id) {
        data.id = uuidv4();
      }

      console.log(`   Inserting into ${table}:`, { 
        id: data.id, 
        to_email: data.to_email || 'N/A',
        subject: data.subject || 'N/A'
      });

      const response = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(data)
      });

      console.log(`   Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`   Error response:`, errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      // For successful inserts with 'return=minimal', response might be empty
      if (response.status === 201 || response.status === 200) {
        // Try to parse JSON, but if empty, return the data we sent
        try {
          const responseData = await response.json();
          return responseData;
        } catch (jsonError) {
          // Empty response is fine for inserts with 'return=minimal'
          console.log(`   Empty response (normal for minimal return)`);
          return [data]; // Return the data we inserted
        }
      }

      return await response.json();

    } catch (error) {
      console.error(`Supabase API error (${table}):`, error.message);
      throw error;
    }
  }

  async select(table, query = '') {
    try {
      const url = query ? `${this.url}/rest/v1/${table}?${query}` : `${this.url}/rest/v1/${table}`;
      
      console.log(`   Selecting from ${table}: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      console.log(`   Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`   Found ${data.length} records`);
      return data;

    } catch (error) {
      console.error(`Supabase API error (${table}):`, error.message);
      throw error;
    }
  }

  async selectSingle(table, column, value) {
    try {
      const encodedValue = encodeURIComponent(value);
      const url = `${this.url}/rest/v1/${table}?${column}=eq.${encodedValue}`;
      
      console.log(`   Selecting single from ${table}: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      console.log(`   Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`   Found ${data.length} matching records`);
      return data[0] || null;

    } catch (error) {
      console.error(`Supabase API error (${table}):`, error.message);
      throw error;
    }
  }
}

module.exports = new SupabaseAPI();