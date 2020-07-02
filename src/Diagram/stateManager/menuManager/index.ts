import { EventBus } from "@eventBus";
import * as Events from "@events";
import { ScreenPosition } from "@io";
import { DiagramTheme, Category, DiagramState } from "@models";
import { Utils } from "@utils";
import { UIManager } from "../uiManager";
import { HtmlManager, HtmlElementRegistration } from "../htmlManager/index";
import { CSSMiniEngine } from "@renderer/CssMiniEngine/index";

const CSS_PREFIX = Utils.getUniquePrefix("MenuManager");

const menuBaseClass = (theme: DiagramTheme) =>
  CSSMiniEngine.createStyle({
    position: "fixed",
    background: theme.colors.menu.background,
    border: theme.colors.menu.borders
      ? `0.5px solid ${theme.colors.menu.borders}`
      : "",
    padding: theme.menu.padding,
    borderRadius: theme.menu.borderRadius,
    width: `${theme.menu.width ? `${theme.menu.width}px` : "auto"}`,
    maxWidth: `${theme.menu.maxWidth}px`,
    maxHeight: `${theme.menu.maxHeight}px`,
    overflowY: "auto",
    zIndex: "100",
  });

const menuElementClass = (theme: DiagramTheme) =>
  CSSMiniEngine.createStyle({
    position: "relative",
    textAlign: "left",
    verticalAlign: "middle",
    color: theme.colors.menu.text,
    fontFamily: theme.fontFamily,
    fontSize: theme.menu.category.fontSize,
    fontWeight: theme.menu.category.fontWeight,
    padding: theme.menu.category.padding,
    transition: "all 0.25s",
    cursor: "pointer",
  });

const menuTitleClass = (theme: DiagramTheme) =>
  CSSMiniEngine.createStyle({
    position: "relative",
    textTransform: "uppercase",
    verticalAlign: "middle",
    color: theme.colors.menu.title,
    fontFamily: theme.fontFamily,
    fontSize: theme.menu.title.fontSize,
    padding: theme.menu.category.padding,
    cursor: "pointer",
    marginBottom: "10px",
    fontWeight: theme.menu.title.fontWeight,
  });

const menuElementClassHover = (theme: DiagramTheme) =>
  CSSMiniEngine.createStyle({
    color: theme.colors.menu.hover,
  });
/**
 * MenuManager:
 *
 */
export class MenuManager {
  activeMenu: HtmlElementRegistration | null = null;
  activeNodeMenu = false;
  activeCategories: Category[] = [];
  activeMenuPosition: ScreenPosition = { x: 0, y: 0 };
  static menuTitleClassName = `${CSS_PREFIX}Title`;
  static menuBaseClassName = `${CSS_PREFIX}Base`;
  static menuElementClassName = `${CSS_PREFIX}Element`;
  static menuElementHoverClassName = `${CSS_PREFIX}ElementHover`;
  constructor(
    private state: DiagramState,
    private eventBus: EventBus,
    // private nodeManager: NodeManager,
    private uiManager: UIManager,
    private htmlManager: HtmlManager
  ) {
    this.eventBus.subscribe(Events.DiagramEvents.MenuRequested, this.openMenu);
    this.eventBus.subscribe(
      Events.DiagramEvents.MenuItemClicked,
      this.clickMenuItem
    );
    this.eventBus.subscribe(
      Events.IOEvents.WorldLeftMouseClick,
      this.closeMenus
    );
    this.eventBus.subscribe(
      Events.IOEvents.ScreenRightMouseUp,
      this.openNewNodeMenu
    );

    CSSMiniEngine.instance.addClass(
      menuBaseClass,
      MenuManager.menuBaseClassName
    );
    CSSMiniEngine.instance.addClass(
      menuElementClass,
      MenuManager.menuElementClassName
    );
    CSSMiniEngine.instance.addClass(
      menuTitleClass,
      MenuManager.menuTitleClassName
    );
    CSSMiniEngine.instance.addClass(
      menuElementClassHover,
      MenuManager.menuElementHoverClassName
    );
  }
  clickMenuItem = (category: Category) => {
    if (category.action) {
      category.action();
      this.closeMenus();
    } else if (category.children) {
      this.state.categories = category.children;
      // this.state.hover.menu = undefined;
      this.openMenu(this.activeMenuPosition);
    }
  };
  /*closeMenu = (e: ScreenPosition) => {
    if (this.state.menu && !this.state.hover.menu) {
      this.state.menu = undefined;
      this.eventBus.publish(Events.DiagramEvents.RenderRequested);
    }
  };*/
  closeMenus = () => {
    this.htmlManager.hideHelp();
    if (this.activeMenu) {
      this.activeMenu.remove();
      this.activeMenu = null;
      this.activeNodeMenu = false;
    }
  };
  openNewNodeMenu = (screenPosition: ScreenPosition) => {
    if (this.state.isReadOnly || this.state.draw) {
      return;
    }
    const { node, link } = this.state.hover;
    if (node) {
      this.activeNodeMenu = true;
    } else if (!node && !link) {
      const createNodePosition: ScreenPosition = this.uiManager.screenToWorld(
        screenPosition
      );
      createNodePosition;
      this.state.categories = this.state.nodeDefinitions
        .filter((n) => n.root)
        .filter((n) => !n.hidden)
        .map(
          (n) =>
            ({
              name: n.type,
              help: n.help,
              action: () => {
                this.eventBus.publish(
                  Events.DiagramEvents.NodeCreationRequested,
                  createNodePosition,
                  n
                );
              },
            } as Category)
        );
      this.openMenu(screenPosition);
    }
  };
  openMenu = (e: ScreenPosition) => {
    this.closeMenus();

    if (this.state.categories.length < 1) {
      return;
    }

    if (this.state.isReadOnly || this.state.draw) {
      return;
    }

    this.activeMenuPosition = e;

    const createNodePosition: ScreenPosition = this.uiManager.screenToWorld(e);
    this.activeCategories = [...this.state.categories];

    const elementsMarkup = this.state.categories
      .map(
        (category, index) =>
          `<div class="${MenuManager.menuElementClassName}" data-ref="category-btn">${category.name}</div>`
      )
      .join("");

    this.activeMenu = this.htmlManager.createElementFromHTML(
      `
        <div class="${MenuManager.menuBaseClassName}" data-ref="root">
          <div class="${MenuManager.menuTitleClassName}">Create Node</div>
          ${elementsMarkup}
        </div>
        `,
      createNodePosition.x,
      createNodePosition.y,
      false,
      { x: 0, y: 0 }
    );
    this.activeMenu.refs["root"]
      .querySelectorAll(`.${MenuManager.menuElementClassName}`)
      .forEach((element, index) => {
        const category = this.activeCategories[index];
        element.addEventListener("click", () => {
          this.eventBus.publish(Events.DiagramEvents.MenuItemClicked, category);
        });
        element.addEventListener("mouseenter", (e) => {
          element.classList.add(MenuManager.menuElementHoverClassName);
          if (category.help) {
            this.htmlManager.renderHelp({
              text: category.help || "",
              title: category.name,
            });
          }
        });
        element.addEventListener("mouseleave", () => {
          element.classList.remove(MenuManager.menuElementHoverClassName);
          this.htmlManager.hideHelp();
        });
      });

    this.eventBus.publish(Events.DiagramEvents.RenderRequested);
  };
}
