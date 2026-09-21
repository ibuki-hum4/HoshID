"use client";

import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LINK_KINDS, type LinkKind } from "@/lib/links";

type MemberProfile = {
  id: string;
  displayName: string;
  image: string | null;
  bio: string | null;
  joinedAt: string;
  links: { kind: string; label: string; url: string }[];
};

export function MemberDirectory({ members }: { members: MemberProfile[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(
      (member) =>
        member.displayName.toLowerCase().includes(needle) ||
        (member.bio ?? "").toLowerCase().includes(needle),
    );
  }, [members, query]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="名前や自己紹介で絞り込む"
          aria-label="メンバーを検索"
          className="pl-9"
        />
      </div>

      <div className="glass-soft overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>メンバー</TableHead>
              <TableHead>自己紹介</TableHead>
              <TableHead>リンク</TableHead>
              <TableHead className="whitespace-nowrap">参加</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                  該当するメンバーはいません。
                </TableCell>
              </TableRow>
            ) : null}

            {filtered.map((member) => (
              <TableRow key={member.id} className="hover:bg-muted/50">
                <TableCell>
                  <Link
                    href={`/lounge/members/${member.id}`}
                    className="flex items-center gap-3 hover:underline"
                  >
                    <Avatar className="size-9 shrink-0">
                      {member.image ? <AvatarImage src={member.image} alt="" /> : null}
                      <AvatarFallback>
                        {member.displayName.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{member.displayName}</span>
                  </Link>
                </TableCell>

                <TableCell className="max-w-md">
                  {member.bio ? (
                    <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                      {member.bio}
                    </p>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>

                <TableCell>
                  {member.links.length === 0 ? (
                    <span className="text-muted-foreground text-sm">—</span>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5">
                      {member.links.map((link) => (
                        <li key={link.url}>
                          <a
                            href={link.url}
                            target="_blank"
                            // 他人が入力した URL なので、参照元とタブの乗っ取りを
                            // 防ぐために必ず付ける。
                            rel="noopener noreferrer nofollow ugc"
                            className="inline-flex"
                          >
                            <Badge
                              variant="outline"
                              className="gap-1 rounded-full font-normal"
                            >
                              {LINK_KINDS[link.kind as LinkKind] ?? "リンク"}
                              <span className="max-w-32 truncate">{link.label}</span>
                              <ExternalLink className="size-3" aria-hidden />
                            </Badge>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(member.joinedAt).toLocaleDateString("ja-JP")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
