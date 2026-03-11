-- Import WWTP RFP Data - Batch 2 (remaining rows)
-- Project ID: 4daa20b1-d1d7-4e14-9718-df2f94865a62

INSERT INTO rfps (
  project_id, organization_id, title, rfp_number, due_date, status, description, custom_fields
) VALUES
-- 3. City of Houston - Broad WWTP projects
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '78302783-41cf-4932-a854-5ebd3666b5ad',
 'Broad WWTP projects through 2028', NULL,
 NULL, 'identified',
 'Seems like a full recycle and/or doubling of expansion',
 '{"country": "USA", "state": "Texas"}'::jsonb),

-- 4. Austin - Walnut Creek WWTP Expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '9df86904-c1b8-4356-9f4a-f55305341f67',
 'Walnut Creek WWTP Expansion to 100 MGD', NULL,
 NULL, 'identified',
 'Major WWTP expansion to 100 MGD capacity',
 '{"country": "USA", "state": "Texas"}'::jsonb),

-- 5. Huntsville - N.B. Davidson WWTP Expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'd148daee-8bc7-4da1-9c87-16b669c8081f',
 'N.B. Davidson WWTP Expansion & Improvements', NULL,
 NULL, 'identified',
 'In line with our technology if aquatic setting adjacent. MAJOR upgrades.',
 '{"country": "USA", "state": "Texas"}'::jsonb),

-- 7. Brazoria County - BCMUD No. 56 WWTP Expansion Phase II
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'bc244955-1e0e-4a07-beeb-17d2ec418f78',
 'BCMUD No. 56 – Wastewater Treatment Plant Expansion Phase II', NULL,
 NULL, 'identified',
 'Expansion of existing concrete common-wall WWTP by adding a second treatment train and associated site/electrical work. Impending new bid round.',
 '{"country": "USA", "state": "Texas"}'::jsonb),

-- 8. Miami-Dade - Recent WWTP bids
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'a0118b99-5275-42b8-aaee-fa5db7d214ea',
 'Miami-Dade WWTP Related Bids (2025-2026)', NULL,
 NULL, 'identified',
 'Had 3-4 recent WWTP related bids, but all due in Nov/Dec 2025. Will check for more in early 2026.',
 '{"country": "USA", "state": "Florida"}'::jsonb),

-- 16. Baltimore - Wastewater collection system support
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '53b94ce3-0a79-4850-8842-06824eddddb4',
 'Wastewater Collection System Support Contracts', NULL,
 NULL, 'identified',
 'Broad wastewater collection system support contracts',
 '{"country": "USA", "state": "Maryland"}'::jsonb),

-- 17. Los Angeles - Pure Water LA
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '3669e2d1-cce7-43e7-8232-62ad15081490',
 'Pure Water Los Angeles Major Infrastructure Program', NULL,
 NULL, 'identified',
 'Upgrade the Hyperion Water Reclamation Plant (HWRP). Major infrastructure program.',
 '{"country": "USA", "state": "California"}'::jsonb),

-- 19. San Diego - South Bay WWTP Rehab & Expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'b208d8c4-d793-44b6-a732-afc377f8b120',
 'South Bay International WWTP Rehab & Expansion', NULL,
 NULL, 'identified',
 'Ongoing phased design/build contracts; major award made; phased construction work anticipated via USIBWC - major expansion but not active - primary large WWTP expansion in San Diego.',
 '{"country": "USA", "state": "California"}'::jsonb),

-- 20. San Diego - City Improvement Program
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'b208d8c4-d793-44b6-a732-afc377f8b120',
 'City Improvement Program - Future Expansion', NULL,
 NULL, 'identified',
 'Future expansion - anticipated but not yet advertised',
 '{"country": "USA", "state": "California"}'::jsonb),

-- 21. Boston - Major CIP
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '9a73b418-e23d-4ae5-b20c-ed1f0d8311de',
 'Major CIP (City Improvement Projects)', NULL,
 NULL, 'identified',
 'Future expansion - anticipated but not yet bid',
 '{"country": "USA", "state": "Massachusetts"}'::jsonb),

-- 22. Tampa Bay - PIPES Plant Upgrades
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'c10c7039-3f69-4ea9-88ac-b2ad533659a7',
 'City of Tampa PIPES Plant Upgrades', NULL,
 NULL, 'identified',
 'Major WWTP upgrades planned',
 '{"country": "USA", "state": "Florida"}'::jsonb),

-- 23. Tampa Bay - Hillsborough County One Water Campus
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'c10c7039-3f69-4ea9-88ac-b2ad533659a7',
 'Hillsborough County One Water Campus AWWTF', NULL,
 NULL, 'identified',
 'New treatment facility planned. Not yet open.',
 '{"country": "USA", "state": "Florida"}'::jsonb),

-- 24. Jacksonville - Royal Lakes WTP
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'a69c8251-ee46-4c21-956f-1ab0c1cb1e12',
 'Royal Lakes WTP Upgrades / Replacement & Expansion', NULL,
 NULL, 'identified',
 'Replacement/expansion of WTPs ($20 million targeted). Was expected mid-2025 but not yet advertised.',
 '{"country": "USA", "state": "Florida"}'::jsonb),

-- 27. Savannah - Recent bids / expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '63a5dfd9-617f-47f6-947d-7fb5d368fd48',
 'Savannah WWTP Expansion Projects', NULL,
 NULL, 'identified',
 'Some recent bids with awards made - worth following for expansion that will occur',
 '{"country": "USA", "state": "Georgia"}'::jsonb),

-- 28. Providence - Infrastructure upgrades
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'f3c3ed59-489d-42a0-8eff-6120ca3eb211',
 'Providence Infrastructure/WWTF Upgrades', NULL,
 NULL, 'identified',
 'Some infrastructure/WWTF upgrades but nothing currently active',
 '{"country": "USA", "state": "Rhode Island"}'::jsonb),

-- 30. New Bedford - Capital Improvement Funding
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '3999ad90-1155-4f32-926b-a8ba139f1946',
 'New Bedford Capital Improvement Funding', NULL,
 NULL, 'identified',
 'Additional $32 million for related projects with $70 million more in bonds! City''s ongoing multi-phased asset upgrade approach.',
 '{"country": "USA", "state": "Massachusetts"}'::jsonb),

-- 31. New Bedford - Future plant expansions
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '3999ad90-1155-4f32-926b-a8ba139f1946',
 'Future Plant Expansions', NULL,
 NULL, 'identified',
 'Expected after design completions',
 '{"country": "USA", "state": "Massachusetts"}'::jsonb),

-- 33. Bridgeport - Clean Water Fund upgrades
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '59d96dc5-41f8-424f-be68-482584e58aa6',
 'Clean Water Fund–funded Plant Upgrades', NULL,
 NULL, 'identified',
 'Major projects expected',
 '{"country": "USA", "state": "Connecticut"}'::jsonb),

-- 36. Yarmouth - Capital Construction Tender
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'a474f935-c269-45c1-8c1e-f2b2f9a865cb',
 'Capital Construction Tender', NULL,
 NULL, 'no_bid',
 'Missed in 2025 but very specific',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 37. Yarmouth - Other wastewater bids
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'a474f935-c269-45c1-8c1e-f2b2f9a865cb',
 'Other Wastewater Construction Bids', NULL,
 NULL, 'identified',
 'More expected',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 38. Bridgewater - RFP2025-08
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'd9588ac0-f1ff-49f2-a61f-5d93f9923100',
 'RFP2025-08 Infrastructure Upgrade Including Wastewater', 'RFP2025-08',
 '2026-06-30 17:00:00-04', 'identified',
 'Design leads to construction bids in 2026',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 39. Bridgewater - Major capital expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'd9588ac0-f1ff-49f2-a61f-5d93f9923100',
 'Major Wastewater Capital Expansion Plan', NULL,
 NULL, 'identified',
 '$69.4M+ funding announced for upgrades — multiple packages likely forthcoming',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 40. Lunenburg - Major capacity upgrade
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'f1a3a761-54e5-44c2-8f3e-b8020c036c64',
 'Major Capacity Upgrade Project', NULL,
 NULL, 'identified',
 'Large multi-phase WWTP upgrade announced (~$28M+). Expected soon.',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 43. Halifax - Advanced procurement
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'e32eed5c-9c86-4223-a0de-97655d641588',
 'Projects in Advanced Procurement Stages', NULL,
 NULL, 'identified',
 'Projects in advanced procurement stages',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 44. Bayfield/Bluewater - WWTP expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'a3e18448-4410-40b6-a68b-ef3b6d320999',
 'WWTP Expansion (Capital) - Additional RFPs Expected', NULL,
 NULL, 'identified',
 'Currently underway in 2025/2026; waiting additional RFPs. Bayfield WWTP capital expansion has already been tendered and awarded.',
 '{"country": "Canada", "region": "Ontario"}'::jsonb),

-- 45. Sooke - Major WWTP expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '0eac2ac9-d63b-4408-8605-392cc2cd9394',
 'Major WWTP Expansion (Core Plant Expansion)', NULL,
 NULL, 'identified',
 'Already underway, nearly complete',
 '{"country": "Canada", "region": "British Columbia"}'::jsonb),

-- 46. Portland - Planned WWTP upgrades
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'c5983d81-80b7-402e-9b58-bd9ec12c73ae',
 'Planned WWTP Major Upgrades (STEP)', NULL,
 NULL, 'identified',
 'Projects TBD',
 '{"country": "USA", "state": "Oregon"}'::jsonb);
