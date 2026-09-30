/**
 * Approximate city-centre coordinates for Indian hackathon venues.
 *
 * These are used only when an event has a city but no venue coordinates. They
 * make the map useful without asking organizers for GPS data or geocoding on
 * every page view. They are not venue-level directions; the event city remains
 * the source of truth and the UI marks inferred pins as approximate.
 */
export interface IndiaCityLocation {
	city: string;
	latitude: number;
	longitude: number;
}

const INDIA_CITIES: Readonly<Record<string, IndiaCityLocation>> = {
	bengaluru: { city: "Bengaluru", latitude: 12.9716, longitude: 77.5946 },
	bangalore: { city: "Bengaluru", latitude: 12.9716, longitude: 77.5946 },
	chennai: { city: "Chennai", latitude: 13.0827, longitude: 80.2707 },
	delhi: { city: "Delhi", latitude: 28.6139, longitude: 77.209 },
	"new delhi": { city: "Delhi", latitude: 28.6139, longitude: 77.209 },
	mumbai: { city: "Mumbai", latitude: 19.076, longitude: 72.8777 },
	hyderabad: { city: "Hyderabad", latitude: 17.385, longitude: 78.4867 },
	pune: { city: "Pune", latitude: 18.5204, longitude: 73.8567 },
	kolkata: { city: "Kolkata", latitude: 22.5726, longitude: 88.3639 },
	kochi: { city: "Kochi", latitude: 9.9312, longitude: 76.2673 },
	ahmedabad: { city: "Ahmedabad", latitude: 23.0225, longitude: 72.5714 },
	jaipur: { city: "Jaipur", latitude: 26.9124, longitude: 75.7873 },
	chandigarh: { city: "Chandigarh", latitude: 30.7333, longitude: 76.7794 },
	lucknow: { city: "Lucknow", latitude: 26.8467, longitude: 80.9462 },
	indore: { city: "Indore", latitude: 22.7196, longitude: 75.8577 },
	visakhapatnam: {
		city: "Visakhapatnam",
		latitude: 17.6868,
		longitude: 83.2185,
	},
	mangaluru: { city: "Mangaluru", latitude: 12.9172, longitude: 74.856 },
	mangalore: { city: "Mangaluru", latitude: 12.9172, longitude: 74.856 },
	mysuru: { city: "Mysuru", latitude: 12.2958, longitude: 76.6394 },
	mysore: { city: "Mysuru", latitude: 12.2958, longitude: 76.6394 },
	coimbatore: { city: "Coimbatore", latitude: 11.0168, longitude: 76.9558 },
	madurai: { city: "Madurai", latitude: 9.9252, longitude: 78.1198 },
	thiruvananthapuram: {
		city: "Thiruvananthapuram",
		latitude: 8.5241,
		longitude: 76.9366,
	},
	trivandrum: {
		city: "Thiruvananthapuram",
		latitude: 8.5241,
		longitude: 76.9366,
	},
	bhubaneswar: { city: "Bhubaneswar", latitude: 20.2961, longitude: 85.8245 },
	patna: { city: "Patna", latitude: 25.5941, longitude: 85.1376 },
	bhopal: { city: "Bhopal", latitude: 23.2599, longitude: 77.4126 },
	nagpur: { city: "Nagpur", latitude: 21.1458, longitude: 79.0882 },
	surat: { city: "Surat", latitude: 21.1702, longitude: 72.8311 },
	vadodara: { city: "Vadodara", latitude: 22.3072, longitude: 73.1812 },
	noida: { city: "Noida", latitude: 28.5355, longitude: 77.391 },
	gurugram: { city: "Gurugram", latitude: 28.4595, longitude: 77.0266 },
	gurgaon: { city: "Gurugram", latitude: 28.4595, longitude: 77.0266 },
	faridabad: { city: "Faridabad", latitude: 28.4089, longitude: 77.3178 },
	ghaziabad: { city: "Ghaziabad", latitude: 28.6692, longitude: 77.4538 },
	"greater noida": {
		city: "Greater Noida",
		latitude: 28.4744,
		longitude: 77.504,
	},
	dehradun: { city: "Dehradun", latitude: 30.3165, longitude: 78.0322 },
	shimla: { city: "Shimla", latitude: 31.1048, longitude: 77.1734 },
	"sri city": { city: "Sri City", latitude: 13.5567, longitude: 79.9996 },
};

const SEARCH_ORDER = Object.keys(INDIA_CITIES).sort(
	(left, right) => right.length - left.length,
);

/** Find a known Indian city inside a venue string, preferring longer names. */
export function findIndiaCityLocation(
	value: string | null | undefined,
): IndiaCityLocation | null {
	if (!value) return null;
	const normalized = value
		.toLocaleLowerCase()
		.replaceAll(/[^\p{L}\p{N}]+/gu, " ");
	for (const key of SEARCH_ORDER) {
		const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		if (new RegExp(`(?:^|\\s)${escaped}(?:$|\\s)`, "u").test(normalized)) {
			return INDIA_CITIES[key] ?? null;
		}
	}
	return null;
}

/** Return a fallback only for a clearly Indian event location. */
export function approximateIndianVenueCoordinates(
	city: string | null | undefined,
	country: string | null | undefined,
): IndiaCityLocation | null {
	const normalizedCountry = country?.trim().toLocaleLowerCase();
	if (
		normalizedCountry &&
		normalizedCountry !== "india" &&
		normalizedCountry !== "in"
	) {
		return null;
	}
	return findIndiaCityLocation(city);
}
