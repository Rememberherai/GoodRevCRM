#!/usr/bin/env tsx
import { insertMunicipalities } from './discover-province';

const municipalities = [
  { name: 'Toronto', province: 'Ontario', country: 'Canada', official_website: 'https://www.toronto.ca', minutes_url: 'https://www.toronto.ca/city-government/council/council-committee-meetings/', municipality_type: 'City', population: 2930000, scan_status: 'pending' },
  { name: 'Ottawa', province: 'Ontario', country: 'Canada', official_website: 'https://ottawa.ca', minutes_url: 'https://pub-ottawa.escribemeetings.com/', municipality_type: 'City', population: 1017000, scan_status: 'pending' },
  { name: 'Mississauga', province: 'Ontario', country: 'Canada', official_website: 'https://www.mississauga.ca', minutes_url: 'https://pub-mississauga.escribemeetings.com/', municipality_type: 'City', population: 721000, scan_status: 'pending' },
  { name: 'Brampton', province: 'Ontario', country: 'Canada', official_website: 'https://www.brampton.ca', minutes_url: 'https://pub-brampton.escribemeetings.com/', municipality_type: 'City', population: 656000, scan_status: 'pending' },
  { name: 'Hamilton', province: 'Ontario', country: 'Canada', official_website: 'https://www.hamilton.ca', minutes_url: 'https://pub-hamilton.escribemeetings.com/', municipality_type: 'City', population: 569000, scan_status: 'pending' },
  { name: 'London', province: 'Ontario', country: 'Canada', official_website: 'https://london.ca', minutes_url: 'https://pub-london.escribemeetings.com/', municipality_type: 'City', population: 422000, scan_status: 'pending' },
  { name: 'Markham', province: 'Ontario', country: 'Canada', official_website: 'https://www.markham.ca', minutes_url: 'https://pub-markham.escribemeetings.com/', municipality_type: 'City', population: 353000, scan_status: 'pending' },
  { name: 'Vaughan', province: 'Ontario', country: 'Canada', official_website: 'https://www.vaughan.ca', minutes_url: 'https://pub-vaughan.escribemeetings.com/', municipality_type: 'City', population: 323000, scan_status: 'pending' },
  { name: 'Kitchener', province: 'Ontario', country: 'Canada', official_website: 'https://www.kitchener.ca', minutes_url: 'https://pub-kitchener.escribemeetings.com/', municipality_type: 'City', population: 256000, scan_status: 'pending' },
  { name: 'Oakville', province: 'Ontario', country: 'Canada', official_website: 'https://www.oakville.ca', minutes_url: 'https://pub-oakville.escribemeetings.com/', municipality_type: 'Town', population: 213000, scan_status: 'pending' },
  { name: 'Richmond Hill', province: 'Ontario', country: 'Canada', official_website: 'https://www.richmondhill.ca', minutes_url: 'https://pub-richmondhill.escribemeetings.com/', municipality_type: 'Town', population: 202000, scan_status: 'pending' },
  { name: 'Oshawa', province: 'Ontario', country: 'Canada', official_website: 'https://www.oshawa.ca', minutes_url: 'https://pub-oshawa.escribemeetings.com/', municipality_type: 'City', population: 166000, scan_status: 'pending' },
  { name: 'Greater Sudbury', province: 'Ontario', country: 'Canada', official_website: 'https://www.greatersudbury.ca', minutes_url: 'https://pub-greatersudbury.escribemeetings.com/', municipality_type: 'City', population: 166000, scan_status: 'pending' },
  { name: 'Barrie', province: 'Ontario', country: 'Canada', official_website: 'https://www.barrie.ca', minutes_url: 'https://www.barrie.ca/government-news/mayor-council-committees/meetings', municipality_type: 'City', population: 153000, scan_status: 'pending' },
  { name: 'Peterborough', province: 'Ontario', country: 'Canada', official_website: 'https://www.peterborough.ca', minutes_url: 'https://pub-peterborough.escribemeetings.com/', municipality_type: 'City', population: 82000, scan_status: 'pending' },
  { name: 'Thunder Bay', province: 'Ontario', country: 'Canada', official_website: 'https://www.thunderbay.ca', minutes_url: 'https://pub-thunderbay.escribemeetings.com/', municipality_type: 'City', population: 107000, scan_status: 'pending' },
  { name: 'Guelph', province: 'Ontario', country: 'Canada', official_website: 'https://guelph.ca', minutes_url: 'https://pub-guelph.escribemeetings.com/', municipality_type: 'City', population: 135000, scan_status: 'pending' },
  { name: 'Whitby', province: 'Ontario', country: 'Canada', official_website: 'https://www.whitby.ca', minutes_url: 'https://pub-whitby.escribemeetings.com/', municipality_type: 'Town', population: 138000, scan_status: 'pending' },
  { name: 'St. Catharines', province: 'Ontario', country: 'Canada', official_website: 'https://www.stcatharines.ca', minutes_url: 'https://stcatharines.civicweb.net/', municipality_type: 'City', population: 133000, scan_status: 'pending' },
  { name: 'Milton', province: 'Ontario', country: 'Canada', official_website: 'https://www.milton.ca', minutes_url: 'https://pub-milton.escribemeetings.com/', municipality_type: 'Town', population: 110000, scan_status: 'pending' },
  { name: 'Ajax', province: 'Ontario', country: 'Canada', official_website: 'https://www.ajax.ca', minutes_url: 'https://events.ajax.ca/meetings', municipality_type: 'Town', population: 119000, scan_status: 'pending' },
  { name: 'Brantford', province: 'Ontario', country: 'Canada', official_website: 'https://www.brantford.ca', minutes_url: 'https://calendar.brantford.ca/meetings', municipality_type: 'City', population: 97000, scan_status: 'pending' },
  { name: 'Chatham-Kent', province: 'Ontario', country: 'Canada', official_website: 'https://www.chatham-kent.ca', minutes_url: 'https://pub-chatham-kent.escribemeetings.com/', municipality_type: 'Municipality', population: 102000, scan_status: 'pending' },
  { name: 'Clarington', province: 'Ontario', country: 'Canada', official_website: 'https://www.clarington.net', minutes_url: 'https://pub-clarington.escribemeetings.com/', municipality_type: 'Municipality', population: 93000, scan_status: 'pending' },
  { name: 'Pickering', province: 'Ontario', country: 'Canada', official_website: 'https://www.pickering.ca', minutes_url: 'https://calendar.pickering.ca/council', municipality_type: 'City', population: 91000, scan_status: 'pending' },
  { name: 'Niagara Falls', province: 'Ontario', country: 'Canada', official_website: 'https://niagarafalls.ca', minutes_url: 'https://niagarafalls.ca/city-government/city-council-and-mayor/agendas-minutes-and-schedule/', municipality_type: 'City', population: 88000, scan_status: 'pending' },
];

insertMunicipalities(municipalities);
