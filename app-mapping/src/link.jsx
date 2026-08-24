import {Link as HeroLink} from "@heroui/react";
import {pathFor} from "./routes.js";
import {canonicalize, serializeQuery} from "./query.js";

export function hrefFor(to, param, patch) {
  const search = patch ? serializeQuery(canonicalize(patch).query) : "";
  return pathFor(to, param) + search;
}

export function Link({to, param, patch, children, className, ...rest}) {
  return (
    <HeroLink href={hrefFor(to, param, patch)} className={className} {...rest}>
      {children}
    </HeroLink>
  );
}
