<?php
namespace TrxDeveloper\Test;

use TrxDeveloper\Plugin;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * SwitchSkin.
 */
class SwitchSkin {

	/**
	 * Constructor.
	 * 
	 * @since 1.0.0
	 * @access public
	 */
	public function __construct() {
		add_filter( 'trx_developer/options/filter_options', array( $this, 'filter_options' ) );
		add_action( 'wp_ajax_trx_developer/btn_switch_skin', array( $this, 'switch_skin' ) );
	}

		/**
	 * filter_options
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function filter_options( $options ) {
		Plugin::$instance->utils->array_insert_before( $options, 'api_figma_block_info', array(
			'switch_skin_info' => array(
				"title" => esc_html__( 'Switch Skin Settings', 'trx-developer' ),
				"type" => "info"
			),
			'switch_skin' => array(
				"title" => esc_html__( 'Switch Skin Name', 'trx-developer' ),
				"class" => "trx_developer_column-1_1",
				"std" => "",
				"type" => "text",
				"test" => 1,
			),
			'btn_switch_skin' => array(
				"title" => esc_html__( 'Switch Skin', 'trx-developer' ),
				"std" => "trx_developer/btn_switch_skin",
				"callback" => "trx_developer/btn_switch_skin",
				"class_field" => "trx_developer_button_accent",
				"fields" => "switch_skin",
				"class" => "trx_developer_column-1_1",
				"type" => "button",
			),
		) );
		return $options;
	}

	/**
	 * curl_switch_skin
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function curl_switch_skin( $url, $method = 'POST', $data = array() ) {
		$wp_app_username = 'lojowaguse1434';
		$wp_app_password = 'Q21m ygZS BmTp TQMG tlGq bOyi';
		$wp_base = 'https://flexify.instawp.dev/';

		$curl_data = array(
			CURLOPT_URL => $wp_base . ltrim( $url, '/' ),
			CURLOPT_TIMEOUT => 60,
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_HTTPHEADER => array(
				'Authorization: Basic ' . base64_encode( $wp_app_username . ':' . str_replace( ' ', '', $wp_app_password ) ),
				'Content-Type: application/json',
			),
		);

		if ( $method == 'POST' ) {
			$curl_data[ CURLOPT_POST ] = true;
			if ( ! empty( $data ) ) {
				$curl_data[ CURLOPT_POSTFIELDS ] = json_encode( $data );
			}
		}

		$curl = curl_init();
		curl_setopt_array( $curl, $curl_data );
		$resp = curl_exec( $curl );
		curl_close( $curl );
		if ( is_string( $resp ) && in_array( substr( $resp, 0, 1 ), array( '[', '{' ) ) ) {
			$resp = json_decode( $resp, true );
		}
		return $resp;
	}

	/**
	 * switch_skin
	 *
	 * @since 1.0.0
	 * @access public
	 */
	public function switch_skin() {
		Plugin::$instance->utils->verify_nonce();

		$response = array(
			'success' => '',
			'error'   => ''
		);

		$fields = Plugin::$instance->html->get_value_gp( 'fields' );

		if ( empty( $fields['switch_skin'] ) ) {
			$response['error'] = esc_html__( 'Empty field switch_skin', 'trx-developer' );

		} else {
			$response['data'] = $this->curl_switch_skin(
				'wp-json/trx-waas-wizard/v1/switch-skin',
				'POST',
				array(
					// 'force' => true,
					'skin'  => sanitize_title( $fields['switch_skin'] )
					// 'skin'  => 'architectural-firm'
					// 'skin' => 'board-games'
					// 'skin' => 'car-repair'
					// 'skin' => 'cleaning'
				)
			);

			if ( ! empty( $response['data']['status'] ) ) {
				for ( $i = 0; $i < 50; $i++ ) {
					sleep(2);
					$result_mas[] = $time_data = $this->curl_switch_skin( 'wp-json/trx-waas-wizard/v1/switch-skin' );
					if ( ! empty( $time_data['status'] ) && ( $time_data['status'] == 'rest_api_end' || $time_data['status'] == 'error' ) ) {
						$response['result_mas'] = $result_mas;
						break;
					}
				}
			}

			// $response['get-skins'] = $this->curl_switch_skin( 'wp-json/trx-waas-wizard/v1/get-skins', 'GET' );
		}

		Plugin::$instance->utils->ajax_response( $response );
	}
}