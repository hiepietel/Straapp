import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ActivitiesPage from "./components/pages/ActivitiesPage";
import ActivityDetailPage from "./components/pages/ActivityDetailPage";
import ProfilePage from "./components/pages/ProfilePage";
import StatisticsPage from "./components/pages/StatisticsPage";
import GearPage from "./components/pages/GearPage";
import HeatmapPage from "./components/pages/HeatmapPage";
import InsightsPage from "./components/pages/InsightsPage";
import Header from "./components/organisms/Header";
import { useAthlete } from "./hooks/useAthlete";
import LoginPage from "./components/pages/LoginPage";
import { useAuth } from "./hooks/useAuth";
import { useRoute } from "./hooks/useRoute";

interface ScreensProps {
  onLogout?: (() => void) | undefined;
}

/** The logged-in (or demo) part of the app: the top bar, and whichever page is open. */
function Screens({ onLogout }: ScreensProps) {
  const route = useRoute();
  const athlete = useAthlete();
  const onList = route.name === "list";

  // The list stays mounted (hidden) while you look at an activity, so going back keeps
  // your filter, every page you loaded and your scroll position. It is only mounted once
  // it has been shown, so opening a link straight to an activity doesn't fetch the list.
  const [listMounted, setListMounted] = useState(onList);
  if (onList && !listMounted) setListMounted(true);

  // Remembered as the user scrolls, not on navigation: by the time a navigation event
  // reaches us React may already have hidden the list, which resets the scroll to 0.
  const listScroll = useRef(0);
  const listVisible = useRef(onList);
  useEffect(() => {
    const track = () => {
      if (listVisible.current) listScroll.current = window.scrollY;
    };
    window.addEventListener("scroll", track, { passive: true });
    return () => window.removeEventListener("scroll", track);
  }, []);

  const routeKey = route.name === "activity" ? `activity:${route.id}` : route.name;
  useLayoutEffect(() => {
    // Flip this first so the scroll caused by hiding the list isn't recorded as the list's.
    listVisible.current = onList;
    window.scrollTo(0, onList ? listScroll.current : 0);
  }, [routeKey, onList]);

  return (
    <>
      <Header athlete={athlete} route={route} onLogout={onLogout} />
      {listMounted && (
        <div hidden={!onList}>
          <ActivitiesPage />
        </div>
      )}
      {route.name === "activity" && <ActivityDetailPage key={route.id} id={route.id} />}
      {route.name === "profile" && <ProfilePage />}
      {route.name === "statistics" && <StatisticsPage />}
      {route.name === "gear" && <GearPage />}
      {route.name === "heatmap" && <HeatmapPage />}
      {route.name === "insights" && <InsightsPage />}
    </>
  );
}

export default function App() {
  const { status, error, login, logout } = useAuth();

  if (status === "demo") return <Screens />;
  if (status === "signedIn") return <Screens onLogout={logout} />;

  // Not mounting the screens here means nothing is fetched until we have a token.
  return <LoginPage onLogin={login} error={error} busy={status === "checking"} />;
}
