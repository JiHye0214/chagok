"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type ThreeGlobeType from "three-globe";

type TravelPoint = {
    city: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
};

type TravelGlobeClientProps = {
    trips: TravelPoint[];
};

type GeoProperties = {
    ISO_A2?: string;
    ISO_A2_EH?: string;
};

type GeoFeature = {
    type: "Feature";
    properties: GeoProperties;
    geometry: {
        type: string;
        coordinates: unknown;
    };
};

type GeoJsonData = {
    type: "FeatureCollection";
    features: GeoFeature[];
};

type GlobeProps = {
    trips: TravelPoint[];
    geoData: GeoJsonData | null;
};

function Globe({ trips, geoData }: GlobeProps) {
    const [globe, setGlobe] = useState<ThreeGlobeType | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadGlobe = async () => {
            const threeGlobeModule = await import("three-globe");

            if (!mounted) return;

            const ThreeGlobe = threeGlobeModule.default;

            const instance = new ThreeGlobe();

            instance.globeMaterial(
                new THREE.MeshStandardMaterial({
                    color: "#A9DDEB",
                    roughness: 1,
                    metalness: 0,
                }),
            );

            instance
                .showAtmosphere(true)
                .atmosphereColor("#E5F7FA")
                .atmosphereAltitude(0.045)
                .polygonAltitude(0.012)
                .polygonStrokeColor(() => "#9FC9A8")
                .polygonSideColor(() => "rgba(100, 150, 110, 0.12)")
                .polygonCapColor((feature: object) => {
                    const geoFeature = feature as GeoFeature;

                    const isoA2 = geoFeature.properties?.ISO_A2;

                    const isoA2EH = geoFeature.properties?.ISO_A2_EH;

                    const code = isoA2 && isoA2 !== "-99" ? isoA2 : isoA2EH || "";

                    const visited = trips.some((trip) => trip.countryCode.toUpperCase() === code.toUpperCase());

                    if (visited) {
                        return "#78C58D";
                    }

                    return "#B8DDB9";
                });

            setGlobe(instance);
        };

        loadGlobe();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!globe || !geoData) return;

        globe.polygonsData(geoData.features);
    }, [globe, geoData]);

    useEffect(() => {
        if (!globe) return;

        globe.pointsData(trips);

        globe.pointLat("latitude");
        globe.pointLng("longitude");

        globe.pointAltitude(0.035);
        globe.pointRadius(0.8);
        globe.pointColor(() => "#F08A78");

        globe.pointsMerge(false);
    }, [globe, trips]);

    if (!globe) {
        return null;
    }

    return <primitive object={globe} />;
}

export default function TravelGlobeClient({ trips }: TravelGlobeClientProps) {
    const [geoData, setGeoData] = useState<GeoJsonData | null>(null);

    useEffect(() => {
        const loadGeoData = async () => {
            try {
                const response = await fetch("/geo/countries.geojson");

                if (!response.ok) {
                    throw new Error("세계지도를 불러오지 못했습니다.");
                }

                const data: GeoJsonData = await response.json();

                setGeoData(data);
            } catch (error) {
                console.error("세계지도 데이터 오류:", error);
            }
        };

        loadGeoData();
    }, []);

    const visitedCountryCount = new Set(trips.map((trip) => trip.countryCode.toUpperCase())).size;

    // UN 회원국 기준 195개국
    const worldProgress = Math.min(Math.round((visitedCountryCount / 195) * 100), 100);

    return (
        <div className="relative h-[390px] w-full overflow-hidden rounded-3xl bg-[#F4F8F3]">
            <Canvas
                camera={{
                    position: [-178, 173, 34],
                    fov: 35,
                }}
                dpr={1}
            >
                <ambientLight intensity={2.8} />

                <directionalLight position={[100, 100, 100]} intensity={1.5} />

                <group scale={0.52}>
                    <Globe trips={trips} geoData={geoData} />
                </group>

                <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    enableDamping
                    dampingFactor={0.08}
                    rotateSpeed={0.25}
                    minPolarAngle={Math.PI * 0.2}
                    maxPolarAngle={Math.PI * 0.8}
                />
            </Canvas>

            {/* 제목 */}
            <div className="pointer-events-none absolute left-5 top-5">
                <p className="text-xs font-medium tracking-wide text-gray-400">MY TRAVEL WORLD</p>

                <p className="mt-1 text-lg font-semibold text-gray-800">내가 가본 곳</p>
            </div>

            {/* 여행 통계 */}
            <div className="pointer-events-none absolute bottom-5 left-5">
                <p className="text-sm text-gray-500">
                    {visitedCountryCount}개국 · {trips.length}개 도시
                </p>

                <p className="mt-1 text-xs text-gray-400">세계일주 {worldProgress}% 완성</p>
            </div>

            {/* 로딩 */}
            {!geoData && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <p className="text-xs text-gray-400">세계지도를 불러오는 중...</p>
                </div>
            )}
        </div>
    );
}
