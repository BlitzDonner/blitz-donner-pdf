/**
 * Editor-Ansicht des PDF-Flipbook-Blocks (ohne Build-Step, nutzt wp-Globals).
 *
 * @package bdpdf
 */
( function ( wp ) {
	'use strict';

	const { registerBlockType } = wp.blocks;
	const el = wp.element.createElement;
	const { useBlockProps, MediaPlaceholder, MediaReplaceFlow, BlockControls, InspectorControls } =
		wp.blockEditor;
	const { PanelBody, ToggleControl } = wp.components;
	const { __ } = wp.i18n;

	const ALLOWED_TYPES = [ 'application/pdf' ];

	registerBlockType( 'bdpdf/flipbook', {
		edit: function ( props ) {
			const { attributes, setAttributes } = props;
			const blockProps = useBlockProps( { className: 'bdpdf-editor' } );

			const onSelect = function ( media ) {
				setAttributes( {
					pdfId: media.id,
					pdfUrl: media.url,
					pdfTitle: media.title || '',
				} );
			};

			if ( ! attributes.pdfUrl ) {
				return el(
					'div',
					blockProps,
					el( MediaPlaceholder, {
						icon: 'book',
						labels: {
							title: __( 'PDF-Flipbook', 'bdpdf' ),
							instructions: __(
								'Wähle ein PDF aus der Mediathek oder lade eines hoch. Es wird im Frontend als blätterbares Buch angezeigt.',
								'bdpdf'
							),
						},
						accept: 'application/pdf',
						allowedTypes: ALLOWED_TYPES,
						onSelect: onSelect,
					} )
				);
			}

			return el(
				'div',
				blockProps,
				el(
					BlockControls,
					{ group: 'other' },
					el( MediaReplaceFlow, {
						mediaId: attributes.pdfId,
						mediaURL: attributes.pdfUrl,
						accept: 'application/pdf',
						allowedTypes: ALLOWED_TYPES,
						onSelect: onSelect,
						name: __( 'PDF ersetzen', 'bdpdf' ),
					} )
				),
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Flipbook-Einstellungen', 'bdpdf' ) },
						el( ToggleControl, {
							label: __( 'Erste Seite als Buchdeckel', 'bdpdf' ),
							help: __(
								'Zeigt die erste Seite einzeln, danach Doppelseiten.',
								'bdpdf'
							),
							checked: !! attributes.showCover,
							onChange: function ( value ) {
								setAttributes( { showCover: value } );
							},
						} )
					)
				),
				el(
					'div',
					{ className: 'bdpdf-editor-preview' },
					el( 'span', { className: 'dashicons dashicons-book bdpdf-editor-icon' } ),
					el(
						'div',
						null,
						el(
							'strong',
							null,
							attributes.pdfTitle || __( 'PDF-Dokument', 'bdpdf' )
						),
						el(
							'p',
							{ className: 'bdpdf-editor-note' },
							__(
								'Wird im Frontend als blätterbares Buch angezeigt.',
								'bdpdf'
							)
						)
					)
				)
			);
		},
		save: function () {
			return null;
		},
	} );
} )( window.wp );
