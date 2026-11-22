"""Optional, explicit local-only navigation link addition for the draft demo.

The default patch is additive and does not touch the existing landing page.
Running this script from a website checkout opts in to local navigation edits.
"""
from __future__ import annotations

import argparse
from pathlib import Path


def add_link(document: str) -> str:
    anchor = '<a href="support.html">Support</a>'
    link = '<a href="evolution.html">Cell evolution</a>'
    if link in document:
        return document
    if anchor not in document:
        raise ValueError('Existing navigation anchor is not present')
    return document.replace(anchor, link + anchor, 1)


def main() -> None:
    parser = argparse.ArgumentParser(description='Opt-in local preview navigation link')
    parser.add_argument('--apply', action='store_true', help='Write the modified local page')
    parser.add_argument('--root', type=Path, default=Path('.'), help='Website checkout root')
    args = parser.parse_args()
    path = args.root / 'index.html'
    original = path.read_text(encoding='utf-8')
    updated = add_link(original)
    if original == updated:
        print('Already linked; unchanged')
    elif args.apply:
        path.write_text(updated, encoding='utf-8')
        print('Local landing page link added')
    else:
        print('DRY RUN: use --apply for an explicit local edit')


if __name__ == '__main__':
    main()
