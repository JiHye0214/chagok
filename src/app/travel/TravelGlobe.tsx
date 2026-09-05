"use client";

import TravelGlobeClient from "./TravelGlobeClient";

type TravelPoint = {
    city: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
};

type TravelGlobeProps = {
    trips: TravelPoint[];
};

export default function TravelGlobe({
    trips,
}: TravelGlobeProps) {
    return <TravelGlobeClient trips={trips} />;
}