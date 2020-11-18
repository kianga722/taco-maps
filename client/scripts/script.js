function appInit() {
    // Loading
    const loadingMessage= document.querySelector('#loading-wrapper');
    // Error Page
    const errorPage = document.querySelector('#error-page');
    // Content
    const content = document.querySelector('#content');
    const header = document.querySelector('header');
    // Settings Dropdown
    const dropdownTrigger = document.querySelector('.dropdown-trigger');
    const dropdownMenu = document.querySelector('.dropdown-menu');
    const reset = document.querySelector('#reset');
    // Modal
    const modalWrapper = document.querySelector('.modal-wrapper');
    const modal = document.querySelector('#modal');
    const modalClose = modal.querySelector('.modal-close');
    const modalContent = modal.querySelector('.modal-content');
    // Copy Success Message
    const copySuccess = document.querySelector('#copy-success-message');
    // Routing
    const routingWrapper = document.querySelector('#routing-wrapper');
    const routingDestination = routingWrapper.querySelector('.routing-destination');
    const routingEnd = document.querySelector('#routing-end');
    // Templates
    const templatePopupContent = document.querySelector('#template-popup-content');
    const templateSearchAgain = document.querySelector('#template-search-again');

    // Leaflet Icons
    const truckIcon = L.icon({
        iconUrl: 'img/truck.png',
        iconSize:     [32, 32], // size of the icon
        iconAnchor:   [16, 31], // point of the icon which will correspond to marker's location
        popupAnchor:  [-3, -22] // point from which the popup should open relative to the iconAnchor
    });
    const foodstandIcon = L.icon({
        iconUrl: 'img/foodstand.png',
        iconSize:     [32, 32], 
        iconAnchor:   [16, 31],
        popupAnchor:  [-3, -22]
    });
    const drinkIcon = L.icon({
        iconUrl: 'img/drink.png',
        iconSize:     [32, 32],
        iconAnchor:   [16, 31], 
        popupAnchor:  [-3, -22]
    });
    const deliIcon = L.icon({
        iconUrl: 'img/deli.png',
        iconSize:     [32, 32], 
        iconAnchor:   [16, 31], 
        popupAnchor:  [-3, -22]
    });
    const tacoIcon = L.icon({
        iconUrl: 'img/taco.png',
        iconSize:     [32, 32], 
        iconAnchor:   [16, 31], 
        popupAnchor:  [-3, -22]
    });
     
    // Static Variables
    const mapboxToken = '';
    
    let POPUP_MIN_WIDTH = 220; 
    const ratingImgMap = {
        0: 'small_0.png',
        1: 'small_1.png',
        1.5: 'small_1_half.png',
        2: 'small_2.png',
        2.5: 'small_2_half.png',
        3: 'small_3.png',
        3.5: 'small_3_half.png',
        4: 'small_4.png',
        4.5: 'small_4_half.png',
        5: 'small_5.png'
    }
    

    // State Variables
    let acceptsLocation = false;
    let searchOnLocationFound = false;

    let allBusinesses = {};
    let currentBusiness = null;
    let currentRoute;
    let userSelectCoords = null;

    let map;
    let foodtruckGroup;
    let foodstandGroup;
    let drinkGroup;
    let deliGroup;
    let regularGroup;
    let userGroup;
    let userMarker = null;

    const popupMapClick = L.popup();
    let isPopupOpen = false;

    let filters = {
        lowPrice: false,
        highRating: false,
        highReviewCount: false,
    }

    // Keep track of which menus are being fetched to avoid duplicate fetching
    const fetchingArr = {};

    // For seeing what categories are out there
    let allCategories = [];



    // Storage Init
    function storageInit() {
        const tacoStorage = window.sessionStorage.getItem('tacoPlaces');
        if (tacoStorage) {
            allBusinesses = JSON.parse(tacoStorage)
        }
    }

    // Init Modal
    function modalInit() {
        modalClose.addEventListener('click', () =>{
            modalWrapper.classList.add('hide')
        })
        modalWrapper.addEventListener('click', e => {
            if (e.target.closest('#modal')) {
                return;
            } else {
                modalWrapper.classList.add('hide');
            }
        })
    }

    // Init map, Tiling, and Routing
    function mapInit() {
        map = L.map('map').fitWorld();

        // Map tiling
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox/streets-v11',
            tileSize: 512,
            zoomOffset: -1,
            accessToken: mapboxToken 
        }).addTo(map);

        // Routing
        L.Routing.control({
            router: L.Routing.mapbox(mapboxToken)
        });
    }

    // Init map Layers
    function mapLayersInit() {
        foodtruckGroup = L.layerGroup().addTo(map);
        foodstandGroup = L.layerGroup().addTo(map);
        drinkGroup = L.layerGroup().addTo(map);
        deliGroup = L.layerGroup().addTo(map);
        regularGroup = L.layerGroup().addTo(map);
        userGroup = L.layerGroup().addTo(map);
        
        const overlayMaps = {
            "Food Trucks": foodtruckGroup,
            "Food Stands": foodstandGroup,
            "Drinks": drinkGroup,
            "Delis": deliGroup,
            "Regular": regularGroup,
            "User": userGroup
        };
    
        L.control.layers(null, overlayMaps).addTo(map)
    }


    // Start routing to target
    function getDirections() {
        // Remove any currently active routes first
        if (currentRoute) {
            map.removeControl(currentRoute);
            routingWrapper.classList.remove('active');
        }
    
        const {lat, lng} = userMarker.getLatLng();
        const {latitude, longitude} = currentBusiness.coordinates;
    
        currentRoute = L.Routing.control({
            units: 'imperial',
            waypoints: [
                L.latLng(lat, lng),
                L.latLng(latitude, longitude)
            ]
        }).addTo(map);
    
        // If open collapsed itinerary, close any current popups on map
        const collapseBtn = document.querySelector('.leaflet-routing-container');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                if (!collapseBtn.classList.contains('leaflet-routing-container-hide')) {
                    map.closePopup();
                }
            })
        }
    
        modalWrapper.classList.add('hide');
        map.closePopup();
    
        routingWrapper.classList.add('active');
        routingDestination.textContent = currentBusiness.name;
        header.classList.add('hide');
    }


    // Copy address to clipboard
    async function copyAddress(event, id) {
        if (!navigator.clipboard) {
            return;
        }
    
        const {clientX, clientY} = event;
        const business = allBusinesses[id]; 
        const addressFormat = business.formatted_address.join(', ')
        
        try {
            await navigator.clipboard.writeText(addressFormat);
            copySuccess.style.top = `${clientY}px`;
            copySuccess.style.left = `${clientX}px`;
            copySuccess.classList.remove('hide');
            setTimeout(() => {
                copySuccess.classList.add('hide');
            }, 1000)
        } catch (error) {
            console.error("Copy failed", error);
        }
    }

    // Open More Details about Restaurant
    function openModal(id) {
        const business = allBusinesses[id]; 
        currentBusiness = business;
    
        // Get today's day
        const today = new Date();
        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long'}).format(today);
    
        const {latitude, longitude} = currentBusiness.coordinates;
        const {
            image_url, 
            name, 
            rating, 
            review_count,
            price, 
            url,
            formatted_hours, 
            phone,
            formatted_address, 
            menuUrl 
        } = currentBusiness;
    
        const distanceMeters = userMarker.getLatLng().distanceTo([latitude, longitude]);
        const distanceMiles = (distanceMeters * 0.00062137119223733).toFixed(1);
    
        const ratingStars = ratingImgMap[rating];
    
        let priceFormat = 'No $ info';
        if (price) {
            priceFormat = price;
        }
    
        // Fill in modal content
        modal.querySelector('.bg-image').src = image_url;
    
        modalContent.querySelector('.name').textContent = name;
    
        modalContent.querySelector('.top-info-left img').src = `img/yelp/${ratingStars}`;
        modalContent.querySelector('.top-info-left img').alt = `${rating} stars`;
        modalContent.querySelector('.top-info-left .review-count').textContent = `${review_count} reviews`;
        modalContent.querySelector('.top-info-left .price').textContent = priceFormat;
        
        modalContent.querySelector('.top-info-right .distance').textContent = `${distanceMiles} mi away`;
        modalContent.querySelector('.top-info-right .tel-wrapper .tel-number').textContent = phone;
        if (phone) {
            modalContent.querySelector('.top-info-right .tel-wrapper').classList.remove('hide')
        } else {
            modalContent.querySelector('.top-info-right .tel-wrapper').classList.add('hide')
        }
    
        modalContent.querySelector('.external-links a.link-yelp').href = url;
        modalContent.querySelector('.external-links a.link-yelp img').alt = `link to ${name} Yelp page`;
        modalContent.querySelector('.external-links a.link-menu').href = menuUrl;
        if (menuUrl && menuUrl !== 'none') {
            modalContent.querySelector('.external-links').classList.add('show-menu')
        } else {
            modalContent.querySelector('.external-links').classList.remove('show-menu')
        }
    
        modalContent.querySelector('.bottom-info-wrapper .hours-wrapper .Monday+.day-hours').textContent = formatted_hours['Monday'];
        modalContent.querySelector('.bottom-info-wrapper .hours-wrapper .Tuesday+.day-hours').textContent = formatted_hours['Tuesday'];
        modalContent.querySelector('.bottom-info-wrapper .hours-wrapper .Wednesday+.day-hours').textContent = formatted_hours['Wednesday'];
        modalContent.querySelector('.bottom-info-wrapper .hours-wrapper .Thursday+.day-hours').textContent = formatted_hours['Thursday'];
        modalContent.querySelector('.bottom-info-wrapper .hours-wrapper .Friday+.day-hours').textContent = formatted_hours['Friday'];
        modalContent.querySelector('.bottom-info-wrapper .hours-wrapper .Saturday+.day-hours').textContent = formatted_hours['Saturday'];
        modalContent.querySelector('.bottom-info-wrapper .hours-wrapper .Sunday+.day-hours').textContent = formatted_hours['Sunday'];
        modalContent.querySelector(`.bottom-info-wrapper .hours-wrapper .${weekday}`).classList.add('highlight');
        modalContent.querySelector(`.bottom-info-wrapper .hours-wrapper .${weekday}+.day-hours`).classList.add('highlight')
    
        modalContent.querySelector('.address-wrapper').textContent = ``;
        for (let line of formatted_address) {
            const addressLine = document.createElement('div');
            addressLine.textContent = line;
            modalContent.querySelector('.address-wrapper').appendChild(addressLine);
        }
    
        modalWrapper.classList.remove('hide');
    }


    // Create content for popups
    function createPopupHTML(restaurant_data) {
        const {
            id,
            latitude,
            longitude,
            image_url,
            name,
            rating,
            review_count,
            price,
            url,
            formatted_hours,
            phone,
            formatted_address,
            menuUrl,
        } = restaurant_data;
    
        // Get today's day
        const today = new Date();
        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long'}).format(today);
    
        const distanceMeters = userMarker.getLatLng().distanceTo([latitude, longitude]);
        const distanceMiles = (distanceMeters * 0.00062137119223733).toFixed(1);
    
        const ratingStars = ratingImgMap[rating];
    
        const priceDisplay = price ? price : 'No $ info';

        // Create popup content
        const popupContentEle = templatePopupContent.content.cloneNode(true);
        popupContentEle.querySelector('.bg-image').style.backgroundImage = `url(${image_url})`;

        popupContentEle.querySelector('.top-info-wrapper .name').textContent = name;
        popupContentEle.querySelector('.top-info-wrapper .distance').textContent = `${distanceMiles} mi away`;
        popupContentEle.querySelector('.top-info-wrapper img').src = `img/yelp/${ratingStars}`;
        popupContentEle.querySelector('.top-info-wrapper img').alt = `${rating} stars`;
        popupContentEle.querySelector('.top-info-wrapper .review-count').textContent = `${review_count} reviews`;
        popupContentEle.querySelector('.top-info-wrapper .price').textContent = priceDisplay;

        popupContentEle.querySelector('.external-links .link-url').href = url;
        popupContentEle.querySelector('.external-links .link-url img').alt = `link to ${name} Yelp page`;

        if (menuUrl && menuUrl !== 'none') {
            popupContentEle.querySelector('.external-links .link-menu').href = menuUrl;
            popupContentEle.querySelector('.external-links .loading-menu').remove();
        } else if (menuUrl === 'none') {
            popupContentEle.querySelector('.external-links .link-menu').remove();
            popupContentEle.querySelector('.external-links .loading-menu').remove();
        } else {
            popupContentEle.querySelector('.external-links .link-menu').remove();
        }

        popupContentEle.querySelector('.bottom-info-wrapper .hours-wrapper .hours-today').textContent = formatted_hours[weekday];

        if (phone) {
            popupContentEle.querySelector('.bottom-info-wrapper .tel-wrapper .tel-number').textContent = phone;
        } else {
            popupContentEle.querySelector('.bottom-info-wrapper .tel-wrapper').remove();
        }

        for (let line of formatted_address) {
            const lineEle = document.createElement('div');
            lineEle.textContent = line;
            popupContentEle.querySelector('.address-wrapper').appendChild(lineEle)
        }

        popupContentEle.querySelector('.address-wrapper').addEventListener('click', e => {
            copyAddress(e, id)
        })

        popupContentEle.querySelector('button').addEventListener('click', () => {
            openModal(id)
        })

        // Need to convert to HTML element since Leaflet does not accept document fragments
        const placeholder = document.createElement('div');
        placeholder.appendChild(popupContentEle);

        return placeholder;
    }

    // Fetch menu for restaurant
    async function getMenu(latitude, longitude, name) {
        let menuUrl = null;
        const restaurantObj = {
            latitude,
            longitude,
            name
        }
    
        try {
            const response = await fetch('/getMenu', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(restaurantObj)
            });
        
            if (response.status === 404) {
                menuUrl = 'none';
            } else {
                const responseJSON = await response.json()
                menuUrl = responseJSON.menuUrl;
            }
        } catch(err) {
            alert(err)
        }
        
        return menuUrl
    }

    async function menuContentUpdate(marker, popupHTMLargs) {
        const {
            latitude,
            longitude,
            name,
            id
        } = popupHTMLargs;

        if (fetchingArr[id]) {
            return
        }
        
        fetchingArr[id] = true;
        const menuUrl = await getMenu(latitude, longitude, name)
        delete fetchingArr[id];

        popupHTMLargs.menuUrl = menuUrl;
        const popupHTML = createPopupHTML(popupHTMLargs)
        marker.setPopupContent(popupHTML)
        marker.update();

        allBusinesses[id].menuUrl = menuUrl;
        window.sessionStorage.setItem('tacoPlaces', JSON.stringify(allBusinesses));
    }

    // Create markers for each restaurant
    function createMarkers(businesses, options) {
        let { 
            modifyAll=false
        } = options;
    
        // Avoid adding duplicate markers to the layers
        if (modifyAll) {
            foodtruckGroup.clearLayers();
            foodstandGroup.clearLayers();
            drinkGroup.clearLayers();
            deliGroup.clearLayers();
            regularGroup.clearLayers();
        }
    
        const allIds = Object.keys(businesses);
        for (let id of allIds) {
            if (!businesses[id].show) {
                continue;
            }
    
            const {latitude, longitude} = businesses[id].coordinates;
            const {
                image_url, 
                name, 
                rating, 
                review_count,
                price, 
                formatted_hours, 
                formatted_address, 
                phone, 
                url,  
                categories,
                menuUrl,
            } = businesses[id];
    
            const popupHTMLargs = {
                id,
                latitude,
                longitude,
                image_url,
                name,
                rating,
                review_count,
                price,
                url,
                formatted_hours,
                phone,
                formatted_address,
                menuUrl,
            };
    
            let popupHTML = createPopupHTML(popupHTMLargs) 
    
            if (filters.lowPrice && (!price || price !== '$')) {
                continue;
            }
    
            if (filters.highRating && rating < 4) {
                continue;
            }
    
            if (filters.highReviewCount && review_count < 50) {
                continue;
            }
    
            let marker = null;
            let isFoodtruck = false;
            let isFoodstand = false;
            let hasDrinks = false;
            let isDeli = false;
            const hasDrinksTest = [
                'bars', 
                'beer_and_wine',
                'beerbar',
                'beergardens',
                'cocktailbars', 
                'gastropubs',
                'irish_pubs',
                'pubs',
                'sportsbars', 
                'tikibars',
                'wine_bars'
            ]
    
            
            for (let cat of categories) {
                // See what categories are out there
                if ( allCategories.indexOf(cat.alias) === -1) {
                    allCategories.push(cat.alias)
                }
    
                if (cat.alias === 'foodtrucks') {
                    isFoodtruck = true;
                    marker = L.marker([latitude, longitude], {icon: truckIcon}).addTo(foodtruckGroup);
    
                } else if (cat.alias === 'foodstands') {
                    isFoodstand = true;
                    marker = L.marker([latitude, longitude], {icon: foodstandIcon}).addTo(foodstandGroup)
                } else if (!hasDrinks && hasDrinksTest.includes(cat.alias)) {
                    hasDrinks = true;
                    marker = L.marker([latitude, longitude], {icon: drinkIcon}).addTo(drinkGroup)
                } else if (cat.alias === 'delis') {
                    isDeli = true;
                    marker = L.marker([latitude, longitude], {icon: deliIcon}).addTo(deliGroup)
                }
    
                if (marker) {
                    marker.on('click', async () => {
                        const currentMenuUrl = allBusinesses[id].menuUrl;
                        if (!currentMenuUrl) {
                            await menuContentUpdate(marker, popupHTMLargs);
                        }
                    })
                    marker.bindPopup(popupHTML, {
                        minWidth: POPUP_MIN_WIDTH, 
                        className: 'popup-restaurant'
                    })
                }
            }
    
            if (!isFoodtruck && !isFoodstand && !hasDrinks && !isDeli) {
                marker = L.marker([latitude, longitude], {icon: tacoIcon}).addTo(regularGroup)
    
                marker.on('click', async () => {
                    const currentMenuUrl = allBusinesses[id].menuUrl;
                    if (!currentMenuUrl) {
                        await menuContentUpdate(marker, popupHTMLargs);
                    }
                })

                marker.bindPopup(popupHTML, {
                    minWidth: POPUP_MIN_WIDTH,
                    className: 'popup-restaurant'
                })
            }
            
        }
    }

    // Init map Buttons
    function mapButtonsInit() {
        const targetButton = L.easyButton('<span class="button-user">&target;</span>', function(btn, map){
            const latlng = userMarker.getLatLng();
            map.setView(latlng, 14)
        });
        targetButton.addTo(map);
        
        const priceToggle = L.easyButton({
            id: 'priceToggle',
            states: [{
                icon: '<span class="filter-price">$</span>',
                stateName: 'filter-price',
                title: 'Low price',
                onClick: function(control) {
                    filters.lowPrice = true;
                    createMarkers(allBusinesses, {modifyAll: true})
                    control.state('any-price');
                }
            }, {
                icon: '<span class="any-price">$</span>',
                stateName: 'any-price',
                title: 'Any price',
                onClick: function(control) {
                    filters.lowPrice = false;
                    createMarkers(allBusinesses, {modifyAll: true})
                    control.state('filter-price');
                },
            }]
        });
        priceToggle.addTo(map);
        
        const ratingToggle = L.easyButton({
            id: 'ratingToggle',
            states: [{
                icon: '<span class="filter-rating">&starf;4+</span>',
                stateName: 'filter-rating',
                title: 'At least 4 stars',
                onClick: function(control) {
                    filters.highRating = true;
                    createMarkers(allBusinesses, {modifyAll: true})
                    control.state('any-rating');
                }
            }, {
                icon: '<span class="any-rating">&starf;4+</span>',
                stateName: 'any-rating',
                title: 'Any rating',
                onClick: function(control) {
                    filters.highRating = false;
                    createMarkers(allBusinesses, {modifyAll: true})
                    control.state('filter-rating');
                },
            }]
        });
        ratingToggle.addTo(map);
        
        const reviewToggle = L.easyButton({
            id: 'reviewToggle',
            states: [{
                icon: '<span class="filter-review">&#9998;50+</span>',
                stateName: 'filter-review',
                title: 'At least 50 reviews',
                onClick: function(control) {
                    filters.highReviewCount = true;
                    createMarkers(allBusinesses, {modifyAll: true})
                    control.state('any-review');
                }
            }, {
                icon: '<span class="any-review">&#9998;50+</span>',
                stateName: 'any-review',
                title: 'Any number of reviews',
                onClick: function(control) {
                    filters.highReviewCount = false;
                    createMarkers(allBusinesses, {modifyAll: true})
                    control.state('filter-review');
                },
            }]
        });
        reviewToggle.addTo(map);
    }

    // Fetch restaurants
    async function fetchPlaces() {

        loadingMessage.classList.remove('hide')

        const latlng = userSelectCoords || map.getCenter();

        try {
            const response = await fetch('/getPlaces', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(latlng)
            });
            const responseJSON = await response.json()

             // Only want to add new businesses when re-searching
            const newBusinesses = {}
            for (let business of responseJSON.data.search.business) {
                if (!allBusinesses.hasOwnProperty(business.id)) {
                    business.show = true;
                    allBusinesses[business.id] = business;
                    newBusinesses[business.id] = business;
                }
            }
            window.sessionStorage.setItem('tacoPlaces', JSON.stringify(allBusinesses));
            createMarkers(newBusinesses, {modifyAll: false})
        } catch(err) {
            alert(err)
        }
        
        // Close
        map.closePopup();
        isPopupOpen = false;

        loadingMessage.classList.add('hide')        
    }

    // Handle finding user location
    function onLocationFound(e) {
        if (!acceptsLocation) {
            acceptsLocation = true
        }
    
        userGroup.clearLayers()
        var radius = 1609; // 1 mile in meters
        userMarker = L.marker(e.latlng).addTo(userGroup)
    
        L.circle(e.latlng, radius).addTo(userGroup);
    
        if (!searchOnLocationFound) {
            if (Object.keys(allBusinesses).length > 0) {
                createMarkers(allBusinesses, {modifyAll: true})
            }
            map.setView(e.latlng, 14)
            fetchPlaces();
            searchOnLocationFound = true;
        }
    }

    // Handles Location Error
    function onLocationError(e) {
        if (acceptsLocation) {
            console.log('location watch error')
        } else {
            loadingMessage.classList.add('hide')
            errorPage.classList.add('active');
            content.classList.add('hide');
        }
    }

    function mobileHidePlan() {
        if (window.screen.width < 700) {
            currentRoute.hide()
        }
    }

    function onMapClick(e) {
        if (currentRoute) {
            mobileHidePlan()
        }
    
        //console.log('categories investiage', allCategories)
        if (isPopupOpen) {
            isPopupOpen = false;
        } else {
            userSelectCoords = e.latlng;

            const searchAgainEle = templateSearchAgain.content.cloneNode(true);
            searchAgainEle.querySelector('button').addEventListener('click', fetchPlaces)

            popupMapClick
                .setLatLng(userSelectCoords)
                .setContent(searchAgainEle)
                .openOn(map);
        }
    }


    // Initialize Storage and Map
    storageInit();
    modalInit();

    mapInit();
    mapLayersInit();
    mapButtonsInit();


    // Event Listeners
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);
    map.on('click', onMapClick);
    map.on('popupopen', () => {
        isPopupOpen = true;
        if (currentRoute) {
            mobileHidePlan()
        }
    });

    document.addEventListener('click', e => {
        if (e.target.closest('.dropdown-menu')) {
            return;
        }
        const isDropdownActive = dropdownMenu.classList.contains('active');
        if (isDropdownActive) {
            dropdownMenu.classList.remove('active');
        }
    })
    dropdownTrigger.addEventListener('click', e => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('active');
    })
    reset.addEventListener('click', () => {
        window.sessionStorage.removeItem('tacoPlaces');
        allBusinesses = {};
        foodtruckGroup.clearLayers();
        foodstandGroup.clearLayers();
        drinkGroup.clearLayers();
        deliGroup.clearLayers();
        regularGroup.clearLayers();
    
        dropdownMenu.classList.remove('active');
    })

    modalContent.querySelector('.get-directions').addEventListener('click', getDirections);

    routingEnd.addEventListener('click', () => {
        map.removeControl(currentRoute);
        routingWrapper.classList.remove('active');
        header.classList.remove('hide');
        isPopupOpen = false;
    })


    // Start app by locating user
    map.locate({watch: true});    
}


appInit();
