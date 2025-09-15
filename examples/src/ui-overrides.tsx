import {
	DefaultToolbar,
	DefaultToolbarContent,
	TLComponents,
	TLUiAssetUrlOverrides,
	TLUiOverrides,
	TldrawUiMenuItem,
	useIsToolSelected,
	useTools,
	useTldrawUiComponents,
	useEditor,
	usePassThroughWheelEvents,
	useValue,
	PORTRAIT_BREAKPOINT,
	useBreakpoint,
	useTranslation,
	TldrawUiToolbar,
} from 'tldraw'
import { memo, useRef } from 'react'
import { UserButton } from '@clerk/react-router'

export const uiOverrides: TLUiOverrides = {
	tools(editor, tools) {
		return tools
	},
}

const CustomMenuPanel = memo(function CustomMenuPanel() {
	const breakpoint = useBreakpoint()
	const msg = useTranslation()
	const ref = useRef<HTMLDivElement>(null)
	usePassThroughWheelEvents(ref)
	const { MainMenu, QuickActions, ActionsMenu, PageMenu } = useTldrawUiComponents()
	const editor = useEditor()
	const isSinglePageMode = useValue('isSinglePageMode', () => editor.options.maxPages <= 1, [editor])
	const showQuickActions =
		editor.options.actionShortcutsLocation === 'menu'
			? true
			: editor.options.actionShortcutsLocation === 'toolbar'
				? false
				: breakpoint >= PORTRAIT_BREAKPOINT.TABLET
	if (!MainMenu && !PageMenu && !showQuickActions) return null
	return (
		<nav ref={ref} className="tlui-menu-zone" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
			<div className="tlui-buttons__horizontal">
				{MainMenu && <MainMenu />}
				{PageMenu && !isSinglePageMode && <PageMenu />}
				{showQuickActions ? (
					<TldrawUiToolbar className="tlui-buttons__horizontal" label={msg('actions-menu.title')}>
						{QuickActions && <QuickActions />}
						{ActionsMenu && <ActionsMenu />}
					</TldrawUiToolbar>
				) : null}
			</div>
			<div style={{ marginLeft: 'auto', marginRight: 8, pointerEvents: 'all' }}>
				<UserButton userProfileUrl="/account" />
			</div>
		</nav>
	)
})

export const components: TLComponents = {
	Toolbar: (props) => {
		return (
			<DefaultToolbar {...props}>
				<DefaultToolbarContent />
			</DefaultToolbar>
		)
	},
	MenuPanel: CustomMenuPanel,
}

export const customAssetUrls: TLUiAssetUrlOverrides = {} 