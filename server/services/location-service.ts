import { Point } from "@shared/schema";

// Mapping postcodes to their main streets/areas for better turn-by-turn directions
export const POSTCODE_STREETS = {
  // Mill Hill area postcodes with their main streets
  "NW7": "Mill Hill",
  "NW7 1": "Mill Hill Broadway",
  "NW7 2": "Frith Lane", 
  "NW7 3": "Holmwood Grove",
  "NW7 4": "Holders Hill Road",
  "NW7 9": "Hammers Lane",
  
  // Other London postcodes
  "NW1": "Camden High Street",
  "NW2": "Cricklewood Broadway",
  "NW3": "Hampstead High Street",
  "NW4": "Hendon Way",
  "NW5": "Kentish Town Road",
  "NW6": "West Hampstead",
  "NW8": "St John's Wood",
  "NW9": "Colindale",
  "NW10": "Willesden",
  "NW11": "Golders Green",
  
  "SW1": "Westminster",
  "SW3": "Chelsea",
  "SW7": "South Kensington",
  "SW11": "Battersea",
  "SW19": "Wimbledon",
  
  "N1": "Islington",
  "N2": "East Finchley",
  "N3": "Finchley Central",
  "N4": "Finsbury Park",
  "N6": "Highgate",
  "N7": "Holloway Road",
  "N8": "Crouch End",
  "N10": "Muswell Hill",
  "N11": "New Southgate",
  "N12": "North Finchley",
  "N14": "Southgate",
  "N20": "Whetstone",
  
  "W1": "Oxford Street",
  "W2": "Paddington",
  "W8": "Kensington",
  "W11": "Notting Hill",
};

// London postcodes with their precise coordinates
export const LONDON_POSTCODES = {
  // Central London postcodes
  "SW1A": { lat: 51.5014, lng: -0.1419 }, // Westminster/Buckingham Palace
  "SW1E": { lat: 51.4978, lng: -0.1389 }, // Victoria
  "SW1H": { lat: 51.4989, lng: -0.1341 }, // St James's Park
  "SW1P": { lat: 51.4956, lng: -0.1291 }, // Westminster
  "SW1V": { lat: 51.4913, lng: -0.1403 }, // Pimlico
  "SW1W": { lat: 51.4943, lng: -0.1501 }, // Belgravia
  "SW1X": { lat: 51.4993, lng: -0.1602 }, // Knightsbridge
  "SW1Y": { lat: 51.5074, lng: -0.1323 }, // St James's
  "W1A": { lat: 51.5161, lng: -0.1416 }, // Oxford Street
  "W1B": { lat: 51.5148, lng: -0.1397 }, // Oxford Circus
  "W1C": { lat: 51.5138, lng: -0.1493 }, // Bond Street
  "W1D": { lat: 51.5129, lng: -0.1308 }, // Soho
  "W1F": { lat: 51.5141, lng: -0.1369 }, // Soho
  "W1G": { lat: 51.5199, lng: -0.1467 }, // Harley Street
  "W1H": { lat: 51.5179, lng: -0.1631 }, // Marylebone
  "W1J": { lat: 51.5074, lng: -0.1434 }, // Mayfair
  "W1K": { lat: 51.5112, lng: -0.1497 }, // Mayfair
  "W1S": { lat: 51.5120, lng: -0.1410 }, // Regent Street
  "W1T": { lat: 51.5209, lng: -0.1351 }, // Fitzrovia
  "W1U": { lat: 51.5189, lng: -0.1511 }, // Marylebone
  "W1W": { lat: 51.5194, lng: -0.1388 }, // Great Portland Street
  "EC1A": { lat: 51.5188, lng: -0.1024 }, // Clerkenwell
  "EC1M": { lat: 51.5201, lng: -0.1021 }, // Farringdon
  "EC1N": { lat: 51.5199, lng: -0.1089 }, // Hatton Garden
  "EC1R": { lat: 51.5248, lng: -0.1082 }, // Finsbury
  "EC1V": { lat: 51.5262, lng: -0.0973 }, // Old Street
  "EC1Y": { lat: 51.5226, lng: -0.0936 }, // Barbican
  "EC2A": { lat: 51.5229, lng: -0.0857 }, // Shoreditch
  "EC2M": { lat: 51.5183, lng: -0.0864 }, // Liverpool Street
  "EC2N": { lat: 51.5158, lng: -0.0853 }, // Bank
  "EC2R": { lat: 51.5145, lng: -0.0900 }, // Bank
  "EC2V": { lat: 51.5154, lng: -0.0957 }, // Guildhall
  "EC2Y": { lat: 51.5205, lng: -0.0945 }, // Barbican
  "EC3A": { lat: 51.5142, lng: -0.0799 }, // Aldgate
  "EC3M": { lat: 51.5118, lng: -0.0818 }, // Monument
  "EC3N": { lat: 51.5109, lng: -0.0785 }, // Tower Hill
  "EC3R": { lat: 51.5101, lng: -0.0842 }, // Monument
  "EC3V": { lat: 51.5123, lng: -0.0876 }, // Monument
  "EC4A": { lat: 51.5166, lng: -0.1084 }, // Fetter Lane
  "EC4M": { lat: 51.5148, lng: -0.1009 }, // St Paul's
  "EC4N": { lat: 51.5137, lng: -0.0914 }, // Mansion House
  "EC4R": { lat: 51.5113, lng: -0.0904 }, // Cannon Street
  "EC4V": { lat: 51.5129, lng: -0.0977 }, // St Paul's
  "EC4Y": { lat: 51.5140, lng: -0.1095 }, // Temple
  "WC1A": { lat: 51.5177, lng: -0.1253 }, // Holborn
  "WC1B": { lat: 51.5193, lng: -0.1248 }, // Bloomsbury
  "WC1E": { lat: 51.5216, lng: -0.1337 }, // University College London
  "WC1H": { lat: 51.5256, lng: -0.1285 }, // King's Cross
  "WC1N": { lat: 51.5226, lng: -0.1201 }, // Bloomsbury
  "WC1R": { lat: 51.5191, lng: -0.1157 }, // Gray's Inn
  "WC1V": { lat: 51.5171, lng: -0.1191 }, // Holborn
  "WC1X": { lat: 51.5277, lng: -0.1155 }, // King's Cross
  "WC2A": { lat: 51.5161, lng: -0.1149 }, // Lincoln's Inn Fields
  "WC2B": { lat: 51.5145, lng: -0.1207 }, // Drury Lane
  "WC2E": { lat: 51.5126, lng: -0.1229 }, // Covent Garden
  "WC2H": { lat: 51.5130, lng: -0.1283 }, // Leicester Square
  "WC2N": { lat: 51.5099, lng: -0.1248 }, // Charing Cross
  "WC2R": { lat: 51.5114, lng: -0.1182 }, // Strand
  "E1": { lat: 51.5174, lng: -0.0678 }, // Whitechapel/Brick Lane
  "E2": { lat: 51.5310, lng: -0.0589 }, // Bethnal Green/Shoreditch
  "E3": { lat: 51.5302, lng: -0.0243 }, // Bow/Mile End
  "E8": { lat: 51.5419, lng: -0.0550 }, // Hackney/Dalston
  "E9": { lat: 51.5446, lng: -0.0358 }, // Hackney Wick/Victoria Park
  "E14": { lat: 51.5055, lng: -0.0177 }, // Canary Wharf/Isle of Dogs
  "E15": { lat: 51.5388, lng: 0.0021 }, // Stratford
  "W2": { lat: 51.5152, lng: -0.1758 }, // Paddington/Bayswater
  "W8": { lat: 51.5000, lng: -0.1927 }, // Kensington
  "W9": { lat: 51.5207, lng: -0.1915 }, // Maida Vale
  "W10": { lat: 51.5235, lng: -0.2132 }, // North Kensington
  "W11": { lat: 51.5121, lng: -0.2049 }, // Notting Hill/Holland Park
  "W12": { lat: 51.5077, lng: -0.2285 }, // Shepherd's Bush
  "N1": { lat: 51.5406, lng: -0.0960 }, // Islington
  "N7": { lat: 51.5560, lng: -0.1156 }, // Holloway
  "SE1": { lat: 51.5050, lng: -0.0930 }, // Southwark/Bankside
  "SE5": { lat: 51.4748, lng: -0.0904 }, // Camberwell
  "SE8": { lat: 51.4800, lng: -0.0249 }, // Deptford
  "SE10": { lat: 51.4816, lng: -0.0098 }, // Greenwich
  "SE11": { lat: 51.4911, lng: -0.1102 }, // Kennington
  "SE15": { lat: 51.4736, lng: -0.0661 }, // Peckham
  "SE16": { lat: 51.4991, lng: -0.0527 }, // Bermondsey/Rotherhithe
  "SE17": { lat: 51.4882, lng: -0.0932 }, // Walworth
  "SE21": { lat: 51.4425, lng: -0.0877 }, // Dulwich
  "SE22": { lat: 51.4574, lng: -0.0705 }, // East Dulwich
  "SE24": { lat: 51.4580, lng: -0.1013 }, // Herne Hill
  "SE26": { lat: 51.4268, lng: -0.0544 }, // Sydenham
  "SW3": { lat: 51.4868, lng: -0.1680 }, // Chelsea
  "SW4": { lat: 51.4634, lng: -0.1389 }, // Clapham
  "SW6": { lat: 51.4761, lng: -0.1995 }, // Fulham
  "SW7": { lat: 51.4968, lng: -0.1764 }, // South Kensington
  "SW8": { lat: 51.4760, lng: -0.1257 }, // Nine Elms
  "SW9": { lat: 51.4681, lng: -0.1132 }, // Brixton
  "SW11": { lat: 51.4700, lng: -0.1683 }, // Battersea
  "SW15": { lat: 51.4592, lng: -0.2187 }, // Putney
  "SW19": { lat: 51.4214, lng: -0.2105 }, // Wimbledon
  
  // Greater London and surrounding areas
  "NW1": { lat: 51.5288, lng: -0.1425 }, // Camden Town
  "NW2": { lat: 51.5575, lng: -0.2175 }, // Cricklewood/Willesden Green
  "NW3": { lat: 51.5545, lng: -0.1750 }, // Hampstead/Belsize Park
  "NW4": { lat: 51.5824, lng: -0.2131 }, // Hendon
  "NW5": { lat: 51.5513, lng: -0.1440 }, // Kentish Town
  "NW6": { lat: 51.5420, lng: -0.1973 }, // Kilburn/West Hampstead
  "NW7": { lat: 51.6139, lng: -0.2330 }, // Mill Hill
  "NW8": { lat: 51.5287, lng: -0.1687 }, // St John's Wood
  "NW9": { lat: 51.5899, lng: -0.2497 }, // Kingsbury/Colindale
  "NW10": { lat: 51.5364, lng: -0.2471 }, // Willesden/Harlesden
  "NW11": { lat: 51.5783, lng: -0.1946 }, // Golders Green
  "N2": { lat: 51.5883, lng: -0.1658 }, // East Finchley
  "N3": { lat: 51.6010, lng: -0.1894 }, // Finchley Central
  "N4": { lat: 51.5717, lng: -0.1060 }, // Finsbury Park
  "N5": { lat: 51.5554, lng: -0.0998 }, // Highbury
  "N6": { lat: 51.5739, lng: -0.1443 }, // Highgate
  "N8": { lat: 51.5834, lng: -0.1232 }, // Crouch End/Hornsey
  "N10": { lat: 51.5937, lng: -0.1435 }, // Muswell Hill
  "N11": { lat: 51.6131, lng: -0.1478 }, // New Southgate/Friern Barnet
  "N12": { lat: 51.6172, lng: -0.1763 }, // North Finchley
  "N13": { lat: 51.6179, lng: -0.1100 }, // Palmers Green
  "N14": { lat: 51.6339, lng: -0.1273 }, // Southgate
  "N15": { lat: 51.5821, lng: -0.0818 }, // Seven Sisters/South Tottenham
  "N16": { lat: 51.5621, lng: -0.0739 }, // Stoke Newington
  "N17": { lat: 51.5975, lng: -0.0692 }, // Tottenham
  "N18": { lat: 51.6149, lng: -0.0654 }, // Upper Edmonton
  "N19": { lat: 51.5671, lng: -0.1283 }, // Archway/Upper Holloway
  "N20": { lat: 51.6302, lng: -0.1763 }, // Whetstone
  "N21": { lat: 51.6397, lng: -0.1036 }, // Winchmore Hill
  "N22": { lat: 51.5982, lng: -0.1103 }, // Wood Green

  "SW20": { lat: 51.4091, lng: -0.2301 }, // Raynes Park
  "KT1": { lat: 51.4103, lng: -0.3021 }, // Kingston upon Thames
  "CR0": { lat: 51.3727, lng: -0.0982 }, // Croydon
  "BR1": { lat: 51.4084, lng: 0.0180 }, // Bromley
  "DA1": { lat: 51.4461, lng: 0.2154 }, // Dartford
  "RM1": { lat: 51.5813, lng: 0.1838 }, // Romford
  "IG1": { lat: 51.5586, lng: 0.0694 }, // Ilford
  "EN1": { lat: 51.6536, lng: -0.0794 }, // Enfield
  "HA0": { lat: 51.5518, lng: -0.3037 }, // Wembley
  "UB1": { lat: 51.5154, lng: -0.3716 }, // Southall
  "TW8": { lat: 51.4872, lng: -0.3063 }, // Brentford
  
  // Additional postcodes in Mill Hill for better coverage of that area
  "NW7 1": { lat: 51.6142, lng: -0.2350 }, // Mill Hill Broadway
  "NW7 2": { lat: 51.6175, lng: -0.2355 }, // Mill Hill East
  "NW7 3": { lat: 51.6139, lng: -0.2330 }, // Mill Hill central/Holmwood area
  "NW7 4": { lat: 51.6170, lng: -0.2257 }, // Mill Hill East/Holders Hill  
  "NW7 9": { lat: 51.6128, lng: -0.2422 }  // Western Mill Hill
};

// London landmarks and locations for autocomplete suggestions
export const LONDON_LOCATIONS = {
  // Current location (defaults to central London)
  "Current Location": { lat: 51.5074, lng: -0.1278 }, // Default to central London as fallback
  
  // Specific requested locations
  "Holmwood Grove, Mill Hill": { lat: 51.6103, lng: -0.2335 }, // Mill Hill specific road
  
  // Mill Hill specific streets for better location accuracy
  "Millway, Mill Hill": { lat: 51.6162, lng: -0.2423 },
  "The Ridgeway, Mill Hill": { lat: 51.6185, lng: -0.2352 },
  "Lawrence Street, Mill Hill": { lat: 51.6156, lng: -0.2368 },
  "Hammers Lane, Mill Hill": { lat: 51.6137, lng: -0.2268 },
  "Devonshire Road, Mill Hill": { lat: 51.6124, lng: -0.2343 },
  "Flower Lane, Mill Hill": { lat: 51.6155, lng: -0.2345 },
  "Page Street, Mill Hill": { lat: 51.6088, lng: -0.2346 },
  "Wise Lane, Mill Hill": { lat: 51.6123, lng: -0.2275 },
  "Marsh Lane, Mill Hill": { lat: 51.6177, lng: -0.2280 },
  "Daws Lane, Mill Hill": { lat: 51.6106, lng: -0.2410 },
  "Holders Hill Road, Mill Hill": { lat: 51.6146, lng: -0.2242 },
  "Gordon Road, Mill Hill": { lat: 51.6114, lng: -0.2324 },
  "Hale Lane, Mill Hill": { lat: 51.6147, lng: -0.2421 },
  "Bunns Lane, Mill Hill": { lat: 51.6125, lng: -0.2412 },
  "Mill Hill Broadway": { lat: 51.6144, lng: -0.2370 }, // Main commercial area
  "Mill Hill East Station": { lat: 51.6176, lng: -0.2098 }, // Underground station
  "Mill Hill The Village": { lat: 51.6175, lng: -0.2345 }, // Historic village center
  "Poets Corner, Mill Hill": { lat: 51.6130, lng: -0.2280 }, // Residential area
  "Mill Hill Park": { lat: 51.6103, lng: -0.2228 }, // Local park
  "Mill Hill School": { lat: 51.6187, lng: -0.2342 }, // Notable landmark
  
  // Parks and open spaces
  "Hyde Park": { lat: 51.5073, lng: -0.1657 },
  "Regent's Park": { lat: 51.5300, lng: -0.1550 },
  "Victoria Park": { lat: 51.5362, lng: -0.0372 },
  "Hampstead Heath": { lat: 51.5608, lng: -0.1426 },
  "Battersea Park": { lat: 51.4791, lng: -0.1550 },
  "Greenwich Park": { lat: 51.4769, lng: -0.0010 },
  "Richmond Park": { lat: 51.4463, lng: -0.2710 },
  "Holland Park": { lat: 51.5033, lng: -0.2030 },
  "Finsbury Park": { lat: 51.5645, lng: -0.1086 },
  "Clapham Common": { lat: 51.4613, lng: -0.1509 },
  
  // Landmarks and attractions
  "London Bridge": { lat: 51.5080, lng: -0.0870 },
  "Tower Bridge": { lat: 51.5055, lng: -0.0754 },
  "Buckingham Palace": { lat: 51.5014, lng: -0.1419 },
  "Thames Path": { lat: 51.5095, lng: -0.1000 },
  "Trafalgar Square": { lat: 51.5080, lng: -0.1280 },
  "The Shard": { lat: 51.5045, lng: -0.0865 },
  "Westminster Abbey": { lat: 51.4994, lng: -0.1276 },
  "St. Paul's Cathedral": { lat: 51.5138, lng: -0.0984 },
  "Covent Garden": { lat: 51.5126, lng: -0.1240 },
  "Piccadilly Circus": { lat: 51.5101, lng: -0.1346 },
  "British Museum": { lat: 51.5194, lng: -0.1269 },
  "Natural History Museum": { lat: 51.4967, lng: -0.1764 },
  "London Eye": { lat: 51.5033, lng: -0.1195 },
  
  // Popular streets and roads in London
  "Oxford Street": { lat: 51.5154, lng: -0.1418 },
  "Baker Street": { lat: 51.5226, lng: -0.1571 },
  "Regent Street": { lat: 51.5126, lng: -0.1410 },
  "Bond Street": { lat: 51.5134, lng: -0.1463 },
  "Kings Road": { lat: 51.4845, lng: -0.1669 },
  "Carnaby Street": { lat: 51.5133, lng: -0.1384 },
  "Portobello Road": { lat: 51.5202, lng: -0.2068 },
  "Holmwood Grove": { lat: 51.6103, lng: -0.2335 }, // Updated to correct Mill Hill location
  "Brick Lane": { lat: 51.5212, lng: -0.0713 },
  "Notting Hill Gate": { lat: 51.5091, lng: -0.1952 },
  "Camden High Street": { lat: 51.5394, lng: -0.1425 },
  "Abbey Road": { lat: 51.5321, lng: -0.1774 },
  "Edgware Road": { lat: 51.5205, lng: -0.1698 },
  "Marylebone High Street": { lat: 51.5198, lng: -0.1506 },
  "Shoreditch High Street": { lat: 51.5271, lng: -0.0792 },
  
  // London areas and neighborhoods
  "Kensington": { lat: 51.5009, lng: -0.1927 },
  "Chelsea": { lat: 51.4878, lng: -0.1680 },
  "Notting Hill": { lat: 51.5139, lng: -0.2040 },
  "Camden Town": { lat: 51.5390, lng: -0.1425 },
  "Soho": { lat: 51.5136, lng: -0.1352 },
  "Shoreditch": { lat: 51.5272, lng: -0.0791 },
  "Mayfair": { lat: 51.5109, lng: -0.1471 },
  "Canary Wharf": { lat: 51.5055, lng: -0.0176 },
  "Brixton": { lat: 51.4626, lng: -0.1147 },
  "Islington": { lat: 51.5383, lng: -0.1030 },
  "Mill Hill": { lat: 51.6139, lng: -0.2330 },
  "Hampstead": { lat: 51.5569, lng: -0.1780 },
  "Highgate": { lat: 51.5717, lng: -0.1482 },
  "Wimbledon": { lat: 51.4214, lng: -0.2105 },
  "Clapham": { lat: 51.4619, lng: -0.1400 },
  "Fulham": { lat: 51.4737, lng: -0.2014 },
  
  // South East England towns and cities
  "Brighton": { lat: 50.8225, lng: -0.1372 },
  "Canterbury": { lat: 51.2800, lng: 1.0800 },
  "Oxford": { lat: 51.7520, lng: -1.2577 },
  "Cambridge": { lat: 52.2053, lng: 0.1218 },
  "Southampton": { lat: 50.9097, lng: -1.4044 },
  "Portsmouth": { lat: 50.8198, lng: -1.0880 },
  "Dover": { lat: 51.1295, lng: 1.3089 },
  "Eastbourne": { lat: 50.7675, lng: 0.2901 },
  "Hastings": { lat: 50.8543, lng: 0.5733 },
  "Maidstone": { lat: 51.2720, lng: 0.5292 },
  "Reading": { lat: 51.4543, lng: -0.9781 },
  "Guildford": { lat: 51.2362, lng: -0.5704 },
  "Milton Keynes": { lat: 52.0406, lng: -0.7594 },
  "Crawley": { lat: 51.1091, lng: -0.1872 },
  "Luton": { lat: 51.8787, lng: -0.4200 },
  "St Albans": { lat: 51.7554, lng: -0.3610 },
  "Windsor": { lat: 51.4839, lng: -0.6044 },
  "Tunbridge Wells": { lat: 51.1325, lng: 0.2678 },
  "Watford": { lat: 51.6565, lng: -0.3903 },
  "Slough": { lat: 51.5105, lng: -0.5950 },
  "Chelmsford": { lat: 51.7343, lng: 0.4733 },
  "Southend-on-Sea": { lat: 51.5459, lng: 0.7077 },
  "Basingstoke": { lat: 51.2667, lng: -1.0876 },
  "Ashford": { lat: 51.1465, lng: 0.8750 },
  "Folkestone": { lat: 51.0782, lng: 1.1803 },
  "Margate": { lat: 51.3899, lng: 1.3848 },
  "Chatham": { lat: 51.3786, lng: 0.5291 },
  "Rochester": { lat: 51.3900, lng: 0.5000 },
  "Colchester": { lat: 51.8959, lng: 0.8919 },
  "Ipswich": { lat: 52.0567, lng: 1.1482 },
  "Bracknell": { lat: 51.4154, lng: -0.7531 },
  "High Wycombe": { lat: 51.6297, lng: -0.7481 },
  "Aylesbury": { lat: 51.8156, lng: -0.8125 },
  "Maidenhead": { lat: 51.5223, lng: -0.7213 },
  
  // Suburban areas in Greater London
  "Croydon": { lat: 51.3762, lng: -0.0982 },
  "Barnet": { lat: 51.6503, lng: -0.2000 },
  "Ealing": { lat: 51.5135, lng: -0.3050 },
  "Bromley": { lat: 51.4058, lng: 0.0146 },
  "Enfield": { lat: 51.6521, lng: -0.0807 },
  "Harrow": { lat: 51.5791, lng: -0.3340 },
  "Hounslow": { lat: 51.4746, lng: -0.3651 },
  "Redbridge": { lat: 51.5590, lng: 0.0741 },
  "Sutton": { lat: 51.3618, lng: -0.1945 },
  "Romford": { lat: 51.5760, lng: 0.1802 },
  "Uxbridge": { lat: 51.5485, lng: -0.4803 },
  "Wembley": { lat: 51.5560, lng: -0.2817 },
  "Kingston upon Thames": { lat: 51.4085, lng: -0.3064 },
  "Richmond upon Thames": { lat: 51.4614, lng: -0.3035 },
  "Ilford": { lat: 51.5586, lng: 0.0687 },
  "Bexleyheath": { lat: 51.4635, lng: 0.1418 },
  "Twickenham": { lat: 51.4428, lng: -0.3320 },
  "Staines": { lat: 51.4295, lng: -0.5124 },
  "Epsom": { lat: 51.3359, lng: -0.2697 },
  "Welwyn Garden City": { lat: 51.8019, lng: -0.2132 },
  "Stevenage": { lat: 51.9026, lng: -0.2032 },
  "Hertford": { lat: 51.7956, lng: -0.0780 },
  "Brentwood": { lat: 51.6234, lng: 0.3073 },
  "Hayes": { lat: 51.5126, lng: -0.4200 },
  "Beckenham": { lat: 51.4088, lng: -0.0283 },
  "Purley": { lat: 51.3355, lng: -0.1143 },
  "Orpington": { lat: 51.3748, lng: 0.0977 },
};

// Type for location suggestion results
export interface LocationSuggestion {
  name: string;
  point: Point;
}

/**
 * Get location suggestions based on a search query
 * @param query The search query string
 * @returns An array of location suggestions that match the query
 */
export async function getLondonLocations(query: string): Promise<LocationSuggestion[]> {
  // If no query is provided, return predefined locations as a starting point
  if (!query || query.trim() === '') {
    // Return all locations if no query is provided
    const locationSuggestions = Object.entries(LONDON_LOCATIONS).map(([name, point]) => ({
      name,
      point
    }));
    
    // Add postcode suggestions
    const postcodeSuggestions = Object.entries(LONDON_POSTCODES).map(([code, point]) => ({
      name: `Postcode ${code}`,
      point
    }));
    
    // Return combined suggestions (limit the number to avoid overwhelming the dropdown)
    return [...locationSuggestions, ...postcodeSuggestions.slice(0, 5)];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const allSuggestions: LocationSuggestion[] = [];
  
  // Filter local locations based on the query
  // Check for common road name suffixes
  const roadSuffixes = ['street', 'road', 'avenue', 'lane', 'drive', 'way', 'grove', 'park', 'place', 'square', 'terrace', 'hill', 'court', 'close'];
  let searchTerms = [normalizedQuery];
  
  // If the query contains a road suffix, also try matching without the suffix
  for (const suffix of roadSuffixes) {
    if (normalizedQuery.endsWith(` ${suffix}`)) {
      const baseRoadName = normalizedQuery.slice(0, -suffix.length - 1);
      searchTerms.push(baseRoadName);
      console.log(`Added base road name "${baseRoadName}" from "${normalizedQuery}"`);
      break;
    }
  }
  
  // If query doesn't contain suffix but might be a partial road name, add common suffixes
  if (!roadSuffixes.some(suffix => normalizedQuery.includes(suffix))) {
    // Only try this for queries that are likely to be street names (at least 3 characters)
    if (normalizedQuery.length >= 3) {
      searchTerms.push(normalizedQuery + ' road');
      searchTerms.push(normalizedQuery + ' street');
      if (normalizedQuery.length >= 4) { // For slightly longer names, try more variants
        searchTerms.push(normalizedQuery + ' grove');
        searchTerms.push(normalizedQuery + ' lane');
      }
    }
  }
  
  console.log(`Expanded search terms: ${searchTerms.join(', ')}`);
  
  const locationSuggestions = Object.entries(LONDON_LOCATIONS)
    .filter(([name]) => {
      const nameLower = name.toLowerCase();
      // Match with any of the search terms
      return searchTerms.some(term => {
        // Either the name contains the term or the term contains the name
        return nameLower.includes(term) || 
               // For short queries, avoid too broad matches
               (term.length > 3 && term.includes(nameLower));
      });
    })
    .map(([name, point]) => ({
      name,
      point
    }));
  
  allSuggestions.push(...locationSuggestions);
  
  // Check if query looks like a postcode or contains postcode-related terms
  const basicPostcodeRegex = /^[a-z]{1,2}[0-9][a-z0-9]?$/i;  // Basic outcode pattern (e.g., SW1, NW7)
  const fullPostcodeRegex = /^[a-z]{1,2}[0-9][a-z0-9]? ?[0-9][a-z]{2}$/i;  // Full postcode pattern (e.g., SW1A 1AA)
  
  const isBasicPostcodeQuery = basicPostcodeRegex.test(normalizedQuery);
  const isFullPostcodeQuery = fullPostcodeRegex.test(normalizedQuery);
  const postcodeTerms = ['post', 'code', 'postcode', 'zip'];
  const containsPostcodeTerm = postcodeTerms.some(term => normalizedQuery.includes(term));
  
  console.log(`Query: "${normalizedQuery}", Is postcode format: ${isBasicPostcodeQuery || isFullPostcodeQuery}, Contains postcode term: ${containsPostcodeTerm}`);
  
  // Extract outcode from a full postcode if needed
  let outcodeFromFullPostcode = '';
  if (isFullPostcodeQuery) {
    const cleanedInput = normalizedQuery.replace(/\s+/g, '').toUpperCase();
    const match = cleanedInput.match(/^[A-Z]{1,2}[0-9][A-Z0-9]?/);
    if (match) {
      outcodeFromFullPostcode = match[0];
      console.log(`Extracted outcode ${outcodeFromFullPostcode} from full postcode query`);
    }
  }
  
  if (isBasicPostcodeQuery || isFullPostcodeQuery || containsPostcodeTerm) {
    // Filter postcodes based on the query
    let searchTerm = normalizedQuery;
    
    // If query contains postcode terms, extract the actual postcode part
    if (containsPostcodeTerm) {
      postcodeTerms.forEach(term => {
        searchTerm = searchTerm.replace(term, '');
      });
      searchTerm = searchTerm.trim();
      console.log(`Extracted postcode search term: "${searchTerm}"`);
    }
    
    // For full postcodes, use the extracted outcode
    if (isFullPostcodeQuery && outcodeFromFullPostcode) {
      searchTerm = outcodeFromFullPostcode.toLowerCase();
    }
    
    const postcodeSuggestions = Object.entries(LONDON_POSTCODES)
      .filter(([code]) => {
        const codeLower = code.toLowerCase();
        
        // If no specific search term after removing postcode terms, show all
        if (containsPostcodeTerm && !searchTerm) {
          return true;
        }
        
        // For full postcode queries, match based on outcode
        if (isFullPostcodeQuery && outcodeFromFullPostcode) {
          return code === outcodeFromFullPostcode || 
                 code.startsWith(outcodeFromFullPostcode) || 
                 outcodeFromFullPostcode.startsWith(code);
        }
        
        // Standard matching
        return codeLower.includes(searchTerm) || 
               (searchTerm && searchTerm.includes(codeLower));
      })
      .map(([code, point]) => ({
        name: `Postcode ${code}`,
        point
      }));
    
    console.log(`Found ${postcodeSuggestions.length} matching postcodes`);
    allSuggestions.push(...postcodeSuggestions);
  }
  
  // If we have enough results from our local data, return them
  if (allSuggestions.length >= 5) {
    return allSuggestions;
  }
  
  // If we don't have enough results, or the query doesn't match our local data,
  // use the Mapbox Geocoding API to get more location suggestions
  try {
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      console.error("Mapbox token is not available");
      return allSuggestions;
    }
    
    // Set up parameters for UK-focused search with a preference for London area
    // The 'proximity' param makes results closer to London appear higher in the list
    const params = new URLSearchParams({
      access_token: mapboxToken,
      types: 'place,locality,neighborhood,address,poi',
      proximity: '-0.1278,51.5074', // London center coordinates
      country: 'gb',
      limit: '5'
    });
    
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedQuery)}.json?${params.toString()}`
    );
    
    if (!response.ok) {
      console.error(`Mapbox API error: ${response.status}`);
      return allSuggestions;
    }
    
    const data = await response.json();
    
    // Add Mapbox results to our suggestions
    if (data.features && data.features.length > 0) {
      const mapboxSuggestions = data.features.map((feature: any) => ({
        name: feature.place_name.split(',')[0], // Get just the first part of the place name
        point: {
          lng: feature.center[0],
          lat: feature.center[1]
        }
      }));
      
      // Add any new suggestions that don't duplicate what we already have
      for (const suggestion of mapboxSuggestions) {
        // Check if we already have this suggestion (by name)
        if (!allSuggestions.some(s => s.name.toLowerCase() === suggestion.name.toLowerCase())) {
          allSuggestions.push(suggestion);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching from Mapbox Geocoding API:", error);
  }
  
  return allSuggestions;
}

/**
 * Geocode a location string (postcode, address, or place name) using Mapbox Geocoding API
 * to get precise coordinates. Returns null if geocoding fails.
 */
export async function geocodeLocation(query: string): Promise<Point | null> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) {
    console.error("Mapbox token not available for geocoding");
    return null;
  }

  try {
    const params = new URLSearchParams({
      access_token: mapboxToken,
      types: 'postcode,place,locality,neighborhood,address,poi',
      proximity: '-0.1278,51.5074',
      country: 'gb',
      limit: '1'
    });

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;
    console.log(`Geocoding "${query}" via Mapbox...`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Mapbox geocoding error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const point: Point = {
        lat: feature.center[1],
        lng: feature.center[0]
      };
      console.log(`Geocoded "${query}" → lat=${point.lat}, lng=${point.lng} (${feature.place_name})`);
      return point;
    }

    console.log(`No geocoding results for "${query}"`);
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

/**
 * Get a location point by name
 * @param name The name of the location
 * @returns The location point or undefined if not found
 */
export function getLocationByName(name: string): Point | undefined {
  // Check if it's a regular location with exact match
  if (name in LONDON_LOCATIONS) {
    return LONDON_LOCATIONS[name as keyof typeof LONDON_LOCATIONS];
  }
  
  // Check if it's a postcode format "Postcode XXX"
  if (name.startsWith('Postcode ')) {
    const code = name.replace('Postcode ', '');
    return LONDON_POSTCODES[code as keyof typeof LONDON_POSTCODES];
  }
  
  // Check for street/road name matching
  const normalizedName = name.toLowerCase().trim();
  const roadSuffixes = ['street', 'road', 'avenue', 'lane', 'drive', 'way', 'grove', 'park', 'place', 'square', 'terrace', 'hill', 'court', 'close'];
  
  // First try to find an exact match with case insensitivity
  for (const [locationName, point] of Object.entries(LONDON_LOCATIONS)) {
    if (locationName.toLowerCase() === normalizedName) {
      console.log(`Found exact location match: ${locationName}`);
      return point;
    }
  }
  
  // Try partial/fuzzy matching for street names
  const isLikelyStreetName = roadSuffixes.some(suffix => normalizedName.includes(suffix));
  if (isLikelyStreetName || normalizedName.length >= 4) {
    console.log(`Trying fuzzy matching for possible street name: ${normalizedName}`);
    
    // Remove common suffixes for matching
    let baseNameToMatch = normalizedName;
    for (const suffix of roadSuffixes) {
      if (normalizedName.endsWith(` ${suffix}`)) {
        baseNameToMatch = normalizedName.slice(0, -suffix.length - 1);
        break;
      }
    }
    
    // Try to find a fuzzy match in our locations
    for (const [locationName, point] of Object.entries(LONDON_LOCATIONS)) {
      const locNameLower = locationName.toLowerCase();
      
      // Check if either name includes the other
      if (locNameLower.includes(baseNameToMatch) || 
          (baseNameToMatch.length > 3 && baseNameToMatch.includes(locNameLower))) {
        console.log(`Found fuzzy street name match: ${locationName} for ${normalizedName}`);
        return point;
      }
      
      // For road names, check if the base parts match
      for (const suffix of roadSuffixes) {
        if (locNameLower.endsWith(` ${suffix}`)) {
          const baseLocationName = locNameLower.slice(0, -suffix.length - 1);
          if (baseLocationName === baseNameToMatch || 
              (baseNameToMatch.length > 3 && baseLocationName.includes(baseNameToMatch)) || 
              (baseLocationName.length > 3 && baseNameToMatch.includes(baseLocationName))) {
            console.log(`Found base road name match: ${locationName} for ${normalizedName}`);
            return point;
          }
        }
      }
    }
  }
  
  // Check if it's a raw postcode (handles full postcodes like "NW7 3DS")
  const cleanPostcode = name.toUpperCase().trim();
  console.log(`Checking if '${name}' is a postcode, cleaned to '${cleanPostcode}'`);
  
  // Check for exact match first
  for (const [code, point] of Object.entries(LONDON_POSTCODES)) {
    if (cleanPostcode === code || cleanPostcode.replace(/\s+/g, '') === code.replace(/\s+/g, '')) {
      console.log(`Found exact postcode match: ${code}`);
      return point;
    }
  }
  
  // If no exact match, try to extract outcode from a full postcode
  // UK postcodes have the format: AA9A 9AA or A9A 9AA or A9 9AA
  const cleanedNoSpaces = cleanPostcode.replace(/\s+/g, '');
  const outcodeMatch = cleanedNoSpaces.match(/^[A-Z]{1,2}[0-9][A-Z0-9]?/);
  
  if (outcodeMatch) {
    const outcode = outcodeMatch[0];
    console.log(`Extracted outcode '${outcode}' from full postcode '${cleanPostcode}'`);
    
    // Check if this outcode exists in our dictionary
    if (outcode in LONDON_POSTCODES) {
      console.log(`Found outcode match: ${outcode}`);
      return LONDON_POSTCODES[outcode as keyof typeof LONDON_POSTCODES];
    }
    
    // Try partial matches (e.g., if we have "NW7" and input is "NW73DS")
    for (const [code, point] of Object.entries(LONDON_POSTCODES)) {
      if (outcode.startsWith(code) || code.startsWith(outcode)) {
        console.log(`Found partial postcode match: ${code} for outcode ${outcode}`);
        return point;
      }
    }
  }
  
  console.log(`No location match found for '${name}'`);
  return undefined;
}