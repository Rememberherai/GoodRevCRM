-- Import WWTP RFP Data
-- Project ID: 4daa20b1-d1d7-4e14-9718-df2f94865a62
-- Generated: 2026-02-05

INSERT INTO rfps (
  project_id, organization_id, title, rfp_number, due_date, status, description, custom_fields
) VALUES
-- 1. Nova Scotia - NEW WATERFORD WATER TREATMENT PLANT PLC UPGRADE
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '6b41bbd5-9fd7-4ebe-8ecd-8f2f331f4d02',
 'NEW WATERFORD WATER TREATMENT PLANT PLC UPGRADE', 'CBRM_T51-2025',
 '2025-01-29 15:00:00-05', 'no_bid',
 'PLC upgrade for New Waterford Water Treatment Plant',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 6. Warwick, NY - Village of Warwick WWTP Upgrades
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'fb798060-c0c4-4a1c-a13b-bb10790c7c5e',
 'Village of Warwick – WWTP Upgrades', NULL,
 '2026-02-04 17:00:00-05', 'identified',
 'Grit removal, sequencing batch reactor system, flow equalization, tertiary filtration, sludge handling, pump stations, and appurtenances',
 '{"country": "USA", "state": "New York"}'::jsonb),

-- 10. Philadelphia - NE & SW Water Pollution Control
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '36ce277c-4593-40c7-96ef-f5608faaf31d',
 'NE & SW Water Pollution Control', '7.16.2025-Phila-WWTP-Owners-Rep-RFP',
 NULL, 'identified',
 'Owners Representative RFP for NE & SW Water Pollution Control facilities',
 '{"country": "USA", "state": "Pennsylvania"}'::jsonb),

-- 11. Seattle/King County - STP DAFT Rehabilitation
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '5f867ef2-4f31-413d-bff9-ae2837244371',
 'South Treatment Plant (STP) DAFT Rehabilitation / Upgrades', NULL,
 NULL, 'identified',
 'May need Lillianah tech to expand',
 '{"country": "USA", "state": "Washington"}'::jsonb),

-- 12. Seattle/King County - West Point Mechanical Work
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '5f867ef2-4f31-413d-bff9-ae2837244371',
 'West Point Treatment Plant Mechanical Work Order', '001571',
 '2026-01-06 17:00:00-08', 'no_bid',
 'Mechanical work order',
 '{"country": "USA", "state": "Washington"}'::jsonb),

-- 13. New Orleans - East Bank STP Phase 1A
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'b3434ff4-2328-42bc-ad2d-1e016d23a226',
 'East Bank Sewage Treatment Plant – Phase 1A Secondary Treatment Upgrade', NULL,
 '2026-01-27 17:00:00-06', 'no_bid',
 'Improvements to East Bank STP including upgrades to North RAS Pump Station and work on up to three final clarifiers. Secondary treatment upgrade indicating expansion/modernization of treatment process equipment and infrastructure.',
 '{"country": "USA", "state": "Louisiana"}'::jsonb),

-- 14. New Orleans - Hydraulic Model Update
('4daa20b1-d1d7-4e14-9718-df2f94865a62', 'b3434ff4-2328-42bc-ad2d-1e016d23a226',
 'RFP – Hydraulic Model Update and Analysis', '2025-SWB-47',
 '2026-01-07 17:00:00-06', 'no_bid',
 'Hydraulic model update - not Lillianah technology fit',
 '{"country": "USA", "state": "Louisiana"}'::jsonb),

-- 15. Baltimore - Back River WWTP Sludge DBFOM
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '53b94ce3-0a79-4850-8842-06824eddddb4',
 'Back River WWTP – Sludge DBFOM Facility', 'RFP 1385R',
 NULL, 'identified',
 'Design-Build-Finance-Operate-Maintain facility for sludge processing. LOOK INTO!',
 '{"country": "USA", "state": "Maryland"}'::jsonb),

-- 18. Los Angeles - Long Beach Aeration
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '3669e2d1-cce7-43e7-8232-62ad15081490',
 'Long Beach Water Reclamation Plant — Aeration System Improvements', NULL,
 '2026-01-27 17:00:00-08', 'no_bid',
 'Aeration system improvements',
 '{"country": "USA", "state": "California"}'::jsonb),

-- 25. Charleston - Sludge Holding Tank Rehab
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '62637122-449c-493b-b9bf-97187c9529a1',
 'North Charleston Sewer District – 26-0003 Sludge Holding Tank Rehab', NULL,
 '2025-12-10 17:00:00-05', 'no_bid',
 'Sludge holding tank rehabilitation',
 '{"country": "USA", "state": "South Carolina"}'::jsonb),

-- 26. Charleston - Felix C. Davis Influent Pump Station
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '62637122-449c-493b-b9bf-97187c9529a1',
 'Felix C. Davis Influent Pump Station PER', NULL,
 '2025-12-04 17:00:00-05', 'no_bid',
 'Influent pump station preliminary engineering report',
 '{"country": "USA", "state": "South Carolina"}'::jsonb),

-- 29. New Bedford - WWTP Improvements
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '3999ad90-1155-4f32-926b-a8ba139f1946',
 'WWTP Improvements — Alkalinity Addition & Instrumentation and Controls', 'IFB 25439137-GC',
 NULL, 'no_bid',
 'Consistent with Lillianah technology. Formal IFB. Missed 2025 deadline.',
 '{"country": "USA", "state": "Massachusetts"}'::jsonb),

-- 32. Bridgeport - West Side WWTP Phase 1
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '59d96dc5-41f8-424f-be68-482584e58aa6',
 'West Side WWTP Improvements, Phase 1 – Site Prep', NULL,
 NULL, 'identified',
 'Large capital expansion project - site preparation phase',
 '{"country": "USA", "state": "Connecticut"}'::jsonb),

-- 34. Victoria Harbour - WWTP Phase 2 Expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '885e2d9e-2d3a-473b-887b-4cfbc9ce08bc',
 'Victoria Harbour WWTP Phase 2 Expansion', NULL,
 '2026-12-31 17:00:00-05', 'identified',
 'Major capacity expansion - municipal plan. Expected late 2026.',
 '{"country": "Canada", "region": "Ontario"}'::jsonb),

-- 35. Whycocomagh - WWTP Upgrade
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '25cd82f6-a4a2-46ba-9d95-579ef08e783f',
 'Whycocomagh WWTP Upgrade Tender', '114244925',
 NULL, 'no_bid',
 'Major plant expansion. Missed 2025 deadline.',
 '{"country": "Canada", "region": "Nova Scotia"}'::jsonb),

-- 47. Tacoma - Central WWTP Expansion
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '0f7ff8fb-ba62-4a25-b9d7-c3c9fb6d9a87',
 'Central WWTP Expansion (Filter/Disinfection upgrades)', NULL,
 '2026-01-20 17:00:00-08', 'no_bid',
 'Filter and disinfection upgrades as part of central plant expansion',
 '{"country": "USA", "state": "Washington"}'::jsonb),

-- 48. Tacoma - North End Trickling Filter
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '0f7ff8fb-ba62-4a25-b9d7-c3c9fb6d9a87',
 'North End Treatment Plant Trickling Filter Upgrade', NULL,
 '2026-01-20 17:00:00-08', 'no_bid',
 'Trickling filter upgrade at North End Treatment Plant',
 '{"country": "USA", "state": "Washington"}'::jsonb),

-- 49. Bremerton - Westside WWTP Upgrades
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '5b5b3260-6166-4930-8d4a-c50219ac1657',
 'Westside WWTP Upgrades', NULL,
 '2026-07-01 17:00:00-07', 'identified',
 'Major capital construction - planned for Summer 2026',
 '{"country": "USA", "state": "Washington"}'::jsonb),

-- 50. Bremerton - Eastside UV Disinfection
('4daa20b1-d1d7-4e14-9718-df2f94865a62', '5b5b3260-6166-4930-8d4a-c50219ac1657',
 'Eastside WWTP UV Disinfection Upgrade', NULL,
 '2026-07-01 17:00:00-07', 'identified',
 'UV disinfection upgrade - planned for Summer 2026',
 '{"country": "USA", "state": "Washington"}'::jsonb);
