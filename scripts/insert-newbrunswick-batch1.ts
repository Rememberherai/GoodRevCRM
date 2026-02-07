#!/usr/bin/env tsx
import { insertMunicipalities } from './discover-province';

const municipalities = [
  {"name":"Moncton","province":"New Brunswick","country":"Canada","municipality_type":"City","population":102571,"official_website":"https://www.moncton.ca","minutes_url":"https://www.moncton.ca/en/my-govt-work-city-council/council-meetings-and-materials","scan_status":"pending"},
  {"name":"Saint John","province":"New Brunswick","country":"Canada","municipality_type":"City","population":80016,"official_website":"https://saintjohn.ca","minutes_url":"https://saintjohn.ca/en/city-hall/council-and-committees/minutes-agendas-and-records","scan_status":"pending"},
  {"name":"Fredericton","province":"New Brunswick","country":"Canada","municipality_type":"City","population":75476,"official_website":"https://www.fredericton.ca","minutes_url":"https://pub-fredericton.escribemeetings.com/","scan_status":"pending"},
  {"name":"Dieppe","province":"New Brunswick","country":"Canada","municipality_type":"City","population":35998,"official_website":"https://www.dieppe.ca","minutes_url":"https://calendrier-calendar.dieppe.ca/council","scan_status":"pending"},
  {"name":"Riverview","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":22724,"official_website":"https://www.townofriverview.ca","minutes_url":"https://www.townofriverview.ca/town-hall/council-and-committees/council-meetings","scan_status":"pending"},
  {"name":"Quispamsis","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":20324,"official_website":"https://www.quispamsis.ca","minutes_url":"https://www.quispamsis.ca/town-government/mayor-and-council/council-meetings/","scan_status":"pending"},
  {"name":"Miramichi","province":"New Brunswick","country":"Canada","municipality_type":"City","population":19577,"official_website":"https://www.miramichi.org","minutes_url":"https://www.miramichi.org/council-meetings-agendas-minutes","scan_status":"pending"},
  {"name":"Edmundston","province":"New Brunswick","country":"Canada","municipality_type":"City","population":18132,"official_website":"https://edmundston.ca","minutes_url":"https://edmundston.ca/en/city-hall/policies-publications/minutes","scan_status":"pending"},
  {"name":"Tracadie","province":"New Brunswick","country":"Canada","municipality_type":"Regional Municipality","population":16564,"official_website":"https://tracadienb.ca","minutes_url":"https://tracadienb.ca/en/town-hall/council-meetings","scan_status":"pending"},
  {"name":"Bathurst","province":"New Brunswick","country":"Canada","municipality_type":"City","population":13241,"official_website":"https://www.bathurst.ca","minutes_url":"https://www.bathurst.ca/council-meetings","scan_status":"pending"},
  {"name":"Rothesay","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":12626,"official_website":"https://www.rothesay.ca","minutes_url":"https://www.rothesay.ca/town-hall/agendas/","scan_status":"pending"},
  {"name":"Shediac","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":9849,"official_website":"https://shediac.ca","minutes_url":"https://shediac.ca/en/town-hall/council-meetings","scan_status":"pending"},
  {"name":"Oromocto","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":9451,"official_website":"https://www.oromocto.ca","minutes_url":"https://www.oromocto.ca/council-meeting-minutes","scan_status":"pending"},
  {"name":"Campbellton","province":"New Brunswick","country":"Canada","municipality_type":"City","population":7485,"official_website":"http://www.campbellton.org","minutes_url":"http://www.campbellton.org/camp2/council.asp","scan_status":"pending"},
  {"name":"Sackville","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":6572,"official_website":"https://sackville.com","minutes_url":"https://sackville.com/town-hall/council-meetings/minutes/","scan_status":"pending"},
  {"name":"Woodstock","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":6260,"official_website":"https://woodstocknb.ca","minutes_url":"https://woodstocknb.ca/minutes-agendas","scan_status":"pending"},
  {"name":"Memramcook","province":"New Brunswick","country":"Canada","municipality_type":"Village","population":5616,"official_website":"https://memramcook.com","minutes_url":"https://memramcook.com/en/site_content/item/57-council-meetings","scan_status":"pending"},
  {"name":"Grand Falls","province":"New Brunswick","country":"Canada","municipality_type":"Regional Municipality","population":5465,"official_website":"https://www.grandsault.com","minutes_url":"https://www.grandsault.com/en/reunionspubliques","scan_status":"pending"},
  {"name":"Grand Bay-Westfield","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":5202,"official_website":"https://grandbaywestfield.ca","minutes_url":"https://grandbaywestfield.ca/council-meetings-agendas-and-minutes/","scan_status":"pending"},
  {"name":"Sussex","province":"New Brunswick","country":"Canada","municipality_type":"Town","population":4994,"official_website":"https://sussex.ca","minutes_url":"https://portal.laserfiche.ca/Portal/Browse.aspx?id=671&repo=r-0001c83b83f2","scan_status":"pending"}
];

insertMunicipalities(municipalities);
