import {useCallback, useEffect, useState} from "react";
import {canonicalize, parseQuery, serializeQuery} from "./query.js";
import {legacyRedirect, matchRoute} from "./routes.js";

function snapshot() {
  const redirect = legacyRedirect(window.location.pathname, window.location.search);
  if (redirect) window.history.replaceState(null, "", redirect);
  const route = matchRoute(window.location.pathname);
  const {query, notes} = canonicalize(parseQuery(window.location.search));
  const allNotes = route.note ? [route.note, ...notes] : notes;
  return {route, query, notes: allNotes};
}

export function useUrlState() {
  const [state, setState] = useState(snapshot);

  useEffect(() => {
    const onPop = () => setState(snapshot());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback(({path, patch} = {}) => {
    const targetPath = path ?? window.location.pathname;
    const baseQuery = path ? {} : parseQuery(window.location.search);
    const {query} = canonicalize({...baseQuery, ...(patch ?? {})});
    window.history.pushState(null, "", targetPath + serializeQuery(query));
    setState(snapshot());
  }, []);

  return {...state, navigate};
}
