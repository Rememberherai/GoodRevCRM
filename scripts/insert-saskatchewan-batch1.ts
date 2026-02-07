#!/usr/bin/env tsx
import { insertMunicipalities } from './discover-province';

const municipalities = [
  {"name":"Saskatoon","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":317480,"official_website":"https://www.saskatoon.ca","minutes_url":"https://www.saskatoon.ca/city-hall/city-council-boards-committees/upcoming-and-past-council-and-committee-meetings","scan_status":"pending"},
  {"name":"Regina","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":249217,"official_website":"https://www.regina.ca","minutes_url":"https://www.regina.ca/city-government/city-council/council-meetings/agendas-and-meeting-documents/","scan_status":"pending"},
  {"name":"Prince Albert","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":40728,"official_website":"https://www.citypa.ca","minutes_url":"https://www.citypa.ca/en/city-hall/Meetings__Minutes_and_Agendas.aspx","scan_status":"pending"},
  {"name":"Moose Jaw","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":36337,"official_website":"https://moosejaw.ca","minutes_url":"https://moosejaw.ca/city-council/","scan_status":"pending"},
  {"name":"Swift Current","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":18154,"official_website":"https://www.swiftcurrent.ca","minutes_url":"https://www.swiftcurrent.ca/about-us/city-council/city-council-2025-meeting-dates-agendas-minutes","scan_status":"pending"},
  {"name":"Yorkton","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":16280,"official_website":"https://www.yorkton.ca","minutes_url":"https://www.yorkton.ca/our-government/council/","scan_status":"pending"},
  {"name":"North Battleford","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":13836,"official_website":"https://www.cityofnb.ca","minutes_url":"https://www.cityofnb.ca/Meetings","scan_status":"pending"},
  {"name":"Lloydminster","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":11843,"official_website":"https://www.lloydminster.ca","minutes_url":"https://www.lloydminster.ca/en/your-city-hall/council-agendas-and-minutes.aspx","scan_status":"pending"},
  {"name":"Warman","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":12419,"official_website":"https://www.warman.ca","minutes_url":"https://warman.civicweb.net/Portal/MeetingTypeList.aspx","scan_status":"pending"},
  {"name":"Weyburn","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":11019,"official_website":"https://weyburn.ca","minutes_url":"https://weyburn.ca/council-agenda-minutes/","scan_status":"pending"},
  {"name":"Estevan","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":10851,"official_website":"https://estevan.ca","minutes_url":"https://estevan.ca/council-meetings-and-agendas-2-2/","scan_status":"pending"},
  {"name":"Martensville","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":10549,"official_website":"https://www.martensville.ca","minutes_url":"https://www.martensville.ca/pages/agendas_and_minutes.html","scan_status":"pending"},
  {"name":"Rural Municipality of Corman Park No. 344","province":"Saskatchewan","country":"Canada","municipality_type":"Rural Municipality","population":8909,"official_website":"https://www.rmcormanpark.ca","minutes_url":"https://www.rmcormanpark.ca/AgendaCenter","scan_status":"pending"},
  {"name":"Humboldt","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":6033,"official_website":"https://humboldt.ca","minutes_url":"https://humboldt.ca/city-council-meetings/","scan_status":"pending"},
  {"name":"Melfort","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":5955,"official_website":"https://www.melfort.ca","minutes_url":"https://melfort.ca/p/minutes-agendas","scan_status":"pending"},
  {"name":"Meadow Lake","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":5322,"official_website":"https://www.meadowlake.ca","minutes_url":"https://www.meadowlake.ca/p/meetings","scan_status":"pending"},
  {"name":"Kindersley","province":"Saskatchewan","country":"Canada","municipality_type":"Town","population":4597,"official_website":"https://www.kindersley.ca","minutes_url":"https://kindersley.civicweb.net/Portal/MeetingTypeList.aspx","scan_status":"pending"},
  {"name":"Nipawin","province":"Saskatchewan","country":"Canada","municipality_type":"Town","population":4265,"official_website":"https://www.nipawin.com","minutes_url":"https://www.nipawin.com/minutesagendas.cfm","scan_status":"pending"},
  {"name":"Melville","province":"Saskatchewan","country":"Canada","municipality_type":"City","population":4562,"official_website":"https://melville.ca","minutes_url":"https://melville.ca/p/agendas-minutes","scan_status":"pending"},
  {"name":"La Ronge","province":"Saskatchewan","country":"Canada","municipality_type":"Town","population":2699,"official_website":"https://www.laronge.ca","minutes_url":"https://www.laronge.ca/p/agendas-and-minutes","scan_status":"pending"}
];

insertMunicipalities(municipalities);
