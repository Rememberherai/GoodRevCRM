#!/usr/bin/env tsx
/**
 * Script to insert all Nova Scotia municipalities into the database
 * Data collected via web search on 2026-02-06
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MunicipalityData {
  name: string;
  province: string;
  country: string;
  minutes_url: string | null;
  municipality_type: string;
}

const novaScotiaMunicipalities: MunicipalityData[] = [
  // REGIONAL MUNICIPALITIES (4)
  {
    name: 'Halifax Regional Municipality',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.halifax.ca/city-hall/agendas-meetings-reports',
    municipality_type: 'regional'
  },
  {
    name: 'Cape Breton Regional Municipality',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://cbrm.ns.ca/cbrm-meetings-and-minutes.html',
    municipality_type: 'regional'
  },
  {
    name: 'Region of Queens Municipality',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.regionofqueens.com/council-governance/council-agendas-minutes-audio/',
    municipality_type: 'regional'
  },
  {
    name: 'West Hants Regional Municipality',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.westhants.ca/government/council-documents.html',
    municipality_type: 'regional'
  },

  // COUNTY MUNICIPALITIES (9)
  {
    name: 'Municipality of the County of Antigonish',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://antigonishcounty.ca/municipal-council-minutes/',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Colchester',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.colchester.ca/council-minutes',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Cumberland',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.cumberlandcounty.ns.ca/municipal-office/council-minutes.html',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Inverness',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://invernesscounty.ca/government/minutes/',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Kings',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.countyofkings.ca/',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Pictou',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://munpict.ca/council/minutes/',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Richmond',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.richmondcounty.ca/council/municipal-documents-agendas-minutes-and-finances.html',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Victoria',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://victoriacounty.com/',
    municipality_type: 'county'
  },
  {
    name: 'Municipality of the County of Annapolis',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://annapoliscounty.ca/',
    municipality_type: 'county'
  },

  // DISTRICT MUNICIPALITIES (11)
  {
    name: 'Municipality of the District of Argyle',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.munargyle.com/minutes-agendas-and-recordings.html',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Barrington',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.barringtonmunicipality.com/council/barrington-council-minutes',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Chester',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://chester.ca/government/council/council-meetings',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Clare',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.clarenovascotia.com/en/governance/council/council-meeting-minutes',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Digby',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://digbymun.ca/government/council-meeting-minutes.html',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of East Hants',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.easthants.ca/',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Guysborough',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://modg.ca/government/councillors/council-minutes',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Lunenburg',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.modl.ca/index.php?option=com_docman&view=list&layout=table&slug=municipal-council&own=0&Itemid=1160&lang=en',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Shelburne',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.municipalityofshelburne.ca/council-meeting-minutes/',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of St. Mary\'s',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.saint-marys.ca/council-agendas-and-minutes.html',
    municipality_type: 'district'
  },
  {
    name: 'Municipality of the District of Yarmouth',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://munyarmouth.ca/index.php/government/agendas-minutes',
    municipality_type: 'district'
  },

  // TOWNS (25)
  {
    name: 'Town of Amherst',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.amherst.ca/index.php?option=com_docman&view=list&layout=table&slug=council-minutes&own=0&Itemid=326',
    municipality_type: 'town'
  },
  {
    name: 'Town of Annapolis Royal',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://annapolisroyal.com/town-hall/council-and-committees/council/',
    municipality_type: 'town'
  },
  {
    name: 'Town of Antigonish',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.townofantigonish.ca/town-hall/council-minutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Berwick',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.berwick.ca/council-minutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Bridgewater',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.bridgewater.ca/town-council/about-town-council/council-agendas-and-minutes',
    municipality_type: 'town'
  },
  {
    name: 'Town of Clark\'s Harbour',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.clarksharbour.com/townminutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Digby',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.digby.ca/town-hall/council-minutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Kentville',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://kentville.ca/town-hall/council-and-committees/minutes-agendas-and-records',
    municipality_type: 'town'
  },
  {
    name: 'Town of Lockeport',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.lockeport.ns.ca/index.php/council/minutes',
    municipality_type: 'town'
  },
  {
    name: 'Town of Lunenburg',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://townoflunenburg.ca/town-government/council-meetings.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Mahone Bay',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.townofmahonebay.ca/council-agendas-minutes--meeting-packages.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Middleton',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.discovermiddleton.ca/town-hall/minutes-agenda',
    municipality_type: 'town'
  },
  {
    name: 'Town of Mulgrave',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.townofmulgrave.ca/town-hall/council-minutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of New Glasgow',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.newglasgow.ca/town-hall/council/council-minutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Oxford',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.oxfordns.ca/town-hall/council-minutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Pictou',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.townofpictou.ca/government/meeting-minutes',
    municipality_type: 'town'
  },
  {
    name: 'Town of Port Hawkesbury',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://townofporthawkesbury.ca/',
    municipality_type: 'town'
  },
  {
    name: 'Town of Shelburne',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.shelburne.ca/en/town-hall/agendas-and-minutes.aspx',
    municipality_type: 'town'
  },
  {
    name: 'Town of Stellarton',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.stellarton.ca/town-hall/council-minutes-and-meetings.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Stewiacke',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.stewiacke.net/',
    municipality_type: 'town'
  },
  {
    name: 'Town of Trenton',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://www.town.trenton.ns.ca/council-meetings.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Truro',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://truro.ca/government/council-agenda-and-minutes.html',
    municipality_type: 'town'
  },
  {
    name: 'Town of Westville',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://westville.ca/Transparency/Council-Minutes-Current',
    municipality_type: 'town'
  },
  {
    name: 'Town of Wolfville',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: 'https://wolfville.ca/town-hall/town-council/minutes-agendas-and-records',
    municipality_type: 'town'
  },
  {
    name: 'Town of Parrsboro',
    province: 'Nova Scotia',
    country: 'Canada',
    minutes_url: null,
    municipality_type: 'town'
  }
];

async function checkIfExists(name: string, province: string): Promise<boolean> {
  const { data } = await supabase
    .from('municipalities')
    .select('id')
    .eq('name', name)
    .eq('province', province)
    .maybeSingle();

  return !!data;
}

async function insertMunicipality(municipality: MunicipalityData) {
  const exists = await checkIfExists(municipality.name, municipality.province);

  if (exists) {
    console.log(`   ⏭️  Already exists: ${municipality.name}`);
    return { skipped: true };
  }

  const { error } = await supabase
    .from('municipalities')
    .insert({
      name: municipality.name,
      province: municipality.province,
      country: municipality.country,
      minutes_url: municipality.minutes_url,
      municipality_type: municipality.municipality_type,
      scan_status: municipality.minutes_url ? 'pending' : 'no_minutes',
    });

  if (error) {
    console.error(`   ❌ Error inserting ${municipality.name}:`, error.message);
    return { error };
  } else {
    const status = municipality.minutes_url ? '✅ Inserted with URL' : '⚠️  Inserted without URL';
    console.log(`   ${status}: ${municipality.name}`);
    return { success: true, hasUrl: !!municipality.minutes_url };
  }
}

async function main() {
  console.log('🇨🇦 Inserting Nova Scotia Municipalities\n');
  console.log(`Total municipalities to process: ${novaScotiaMunicipalities.length}\n`);

  let inserted = 0;
  let skipped = 0;
  let failed = 0;
  let withUrls = 0;
  let withoutUrls = 0;

  for (const municipality of novaScotiaMunicipalities) {
    const result = await insertMunicipality(municipality);

    if (result.skipped) {
      skipped++;
    } else if (result.error) {
      failed++;
    } else if (result.success) {
      inserted++;
      if (result.hasUrl) {
        withUrls++;
      } else {
        withoutUrls++;
      }
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted} (${withUrls} with URLs, ${withoutUrls} without)`);
  console.log(`   ⏭️  Skipped (already exist): ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`\n✨ Done! Nova Scotia municipalities are ready for scanning.`);
}

main().catch(console.error);
