# uni-gtw

**uni-gtw** is a custom firmware for ESP32 chips designed to control motorized blinds manufacured by [Mobilus Motor Sp. z o.o.](https://mobilus.pl/). It is compatible with the [**COSMO | 2WAY**](https://mobilus.pl/technologie/2way/) RF protocol, as well as the older **COSMO** protocol (manufactured before 2017.06). The gateway can be easily integrated with [Home Assistant](https://www.home-assistant.io/) using MQTT.

This project is not affiliated with Mobilus Motor Sp. z o.o. in any way. It is completely unofficial and has been developed as due to poor integration options and cost of the official smart home gateway. 

![Screenshot of the gateway's web interface](./docs/static/img/uni-gtw-main-screenshot.png)


## Documentation

## Development

Requirements:

 - git 
 - [esp-idf](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/get-started/index.html) v6.0.1+
 - nodejs
 - [pnpm](https://pnpm.io/)


1. Clone the repository with submodules:

    ```sh
    git clone --recursive git@github.com:alufers/uni-gtw.git
    ```

    (Run `git submodule update --init --recursive` if you already cloned the repo without the `--recursive` flag)

2. Activate the esp-idf environment

    ```sh
    . /opt/esp-idf/export.sh
    ```

    Substitute `/opt/esp-idf` to the installation path of esp-idf on your machine.

3.  Select a preset to use depending on the chip you have

    ```sh
    export IDF_PRESET=default # esp32c3
    # or
    export IDF_PRESET=esp32s3
    # or
    export IDF_PRESET=esp32
    ```

4. Build the firmware

    ```sh
    idf.py build
    ```

    The frontend will be automatically built and embedded into the firmware.

5. Flash the firmware and monitor the serial output

    ```sh
    idf.py flash -p <your serial port> && idf.py monitor -p <your serial port>
    ```
6. The firmware should be running on the device. By default it will create an open Wi-Fi network called `UNI-GTW` which you can use to connect the device to your home network. When connected to the devices netowrk navigate to `http://192.168.1.4` to access the web interface. You should be prompted for your Wi-Fi credentials there.

## License

[GPLv3](./LICENSE)
