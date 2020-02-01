import emojiRegex from "emoji-regex";
import { Plugin } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { Node as ProsemirrorNode, NodeType } from "prosemirror-model";
import { textblockTypeInputRule } from "prosemirror-inputrules";
import { setBlockType } from "prosemirror-commands";
import { MarkdownSerializerState } from "prosemirror-markdown";
import backspaceToParagraph from "../commands/backspaceToParagraph";
import toggleBlockType from "../commands/toggleBlockType";
import headingToSlug from "../lib/headingToSlug";
import Node from "./Node";

export default class Heading extends Node {
  get name() {
    return "heading";
  }

  get defaultOptions() {
    return {
      levels: [1, 2, 3, 4],
    };
  }

  get schema() {
    return {
      attrs: {
        level: {
          default: 1,
        },
        slug: {
          default: "",
        },
      },
      content: "inline*",
      group: "block",
      defining: true,
      draggable: false,
      parseDOM: this.options.levels.map(level => ({
        tag: `h${level}`,
        attrs: { level },
      })),
      toDOM: (node: ProsemirrorNode) => [`h${node.attrs.level}`, 0],
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write(state.repeat("#", node.attrs.level) + " ");
    state.renderInline(node);
    state.closeBlock(node);
  }

  parseMarkdown() {
    return {
      block: "heading",
      getAttrs: (token: Record<string, any>) => ({
        level: +token.tag.slice(1),
      }),
    };
  }

  commands({ type, schema }) {
    return (attrs: Record<string, any>) => {
      return toggleBlockType(type, schema.nodes.paragraph, attrs);
    };
  }

  keys({ type }: { type: NodeType }) {
    const options = this.options.levels.reduce(
      (items, level) => ({
        ...items,
        ...{
          [`Shift-Ctrl-${level}`]: setBlockType(type, { level }),
        },
      }),
      {}
    );

    return {
      ...options,
      Backspace: backspaceToParagraph(type),
    };
  }

  get plugins() {
    return [
      new Plugin({
        props: {
          decorations: state => {
            const { doc } = state;
            const decorations: Decoration[] = [];
            let index = 0;

            doc.descendants((node, pos) => {
              if (node.type.name !== this.name) return;

              // offset emoji in document title node
              if (node.attrs.level === 1) {
                const regex = emojiRegex();
                const text = node.textContent;
                const matches = regex.exec(text);
                const firstEmoji = matches ? matches[0] : null;
                const startsWithEmoji =
                  firstEmoji && text.startsWith(firstEmoji);

                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: startsWithEmoji ? "with-emoji" : undefined,
                  })
                );
              }

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  name: headingToSlug(node, index++),
                  nodeName: "a",
                })
              );
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  }

  inputRules({ type }: { type: NodeType }) {
    return this.options.levels.map(level =>
      textblockTypeInputRule(new RegExp(`^(#{1,${level}})\\s$`), type, () => ({
        level,
      }))
    );
  }
}

// const CollapseToggle = styled.a`
//   text-decoration: none;
//   opacity: ${props => (props.disabled ? "0" : "1")};
//   pointer-events: ${props => (props.disabled ? "none" : "all")};
//   visibility: ${props => (props.collapsed ? "visible" : "hidden")};
//   user-select: none;
//   cursor: pointer;
//   width: 24px;
//   height: 24px;

//   svg {
//     ${props => props.collapsed && "transform: rotate(-90deg);"};
//     fill: ${props =>
//       props.collapsed ? props.theme.text : props.theme.placeholder};
//     transition: transform 100ms ease-in-out;
//   }

//   &:hover {
//     text-decoration: none;

//     svg {
//       fill: ${props => props.theme.text};
//     }
//   }
// `;

// export const StyledHeading = styled(Heading)`
//   display: flex;
//   align-items: center;
//   position: relative;
//   margin-left: -24px;

//   &:hover {
//     ${CollapseToggle} {
//       visibility: visible;
//     }
//   }
// `;

// const HiddenAnchor = styled.a`
//   visibility: hidden;
//   display: block;
//   position: relative;
//   top: -50px;
// `;