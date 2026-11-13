// the groups of an element, written in data-group as a list of names separated by spaces from the
// outermost group to the innermost, e.g. "g3 g1" on an element of g1 inside g3. a list of one name
// is a group without nesting, as in a deck written before groups nested. the scope is the list of
// the groups that the user entered, inside which a click selects a member or an inner group

export const groupsOf = (el: Element): string[] => el.getAttribute('data-group')?.split(/\s+/).filter(Boolean) ?? [];

// the value of data-group for list, null for an element outside every group
export const groupValue = (list: string[]): string | null => (list.length ? list.join(' ') : null);

let scope: string[] = [];
export const scopeOf = (): string[] => scope;
export function setScope(list: string[]): void {
  scope = list;
}

// whether el, or the element of a group that holds it, e.g. the figure of a picture, is inside
// every group of list
export function within(el: Element, list: string[] = scope): boolean {
  const g = el.closest('[data-group]');
  const own = g ? groupsOf(g) : [];
  return list.every((n, i) => own[i] === n);
}

// the group of el seen from the scope, i.e. the name after the names of the scope, or the
// outermost name of an element outside the scope
export function groupOf(el: Element): string | null {
  const list = groupsOf(el);
  return (within(el) ? list[scope.length] : list[0]) ?? null;
}

// whether name is a group on the page or in text, as a word of any data-group
export function groupUsed(name: string, text: string): boolean {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return !!document.querySelector(`[data-group~="${CSS.escape(name)}"]`) || new RegExp(`data-group="(?:[^"]*\\s)?${esc}(?:\\s[^"]*)?"`).test(text);
}

// the lists of the copies els of one selection, with each name mapped once to a fresh name, so that
// the copies keep the nesting of their originals. a name of one copy is left out, and so is a name
// that holds the same copies as the name inside it, e.g. the entered group of a copied inner group
export function copiedGroups(els: Element[], fresh: (taken: Set<string>) => string): (string | null)[] {
  const lists = els.map(groupsOf);
  const holders = new Map<string, string>();
  lists.forEach((list, i) => list.forEach((n) => holders.set(n, `${holders.get(n) ?? ''} ${i}`)));
  const shared = (n: string) => holders.get(n)!.includes(' ', 1);
  const names = new Map<string, string>();
  return lists.map((list) => groupValue(list.filter((n, k) => shared(n) && holders.get(n) !== holders.get(list[k + 1])).map((n) => {
    if (!names.has(n)) names.set(n, fresh(new Set(names.values())));
    return names.get(n) as string;
  })));
}
