import { ISODate } from '../src/constants/Booking';
import { MerlinCalendarDay, MerlinCalendarMonth } from '../src/constants/types';
import { DateService } from '../src/services/date.service';

export const generateCalendar = (
  startDaysFromToday: number,
  bookingLength: number,
  numberOfBookings: number
): MerlinCalendarMonth[] => {
  const today = new Date(new DateService().today);
  const endDate = new Date(today);
  endDate.setMonth(today.getMonth() + 6);

  const daysArray: MerlinCalendarDay[] = [];
  const bookings: { start: Date; end: Date }[] = [];

  // Generate bookings with 2 days gap between them
  let currentStart = new Date(today);
  currentStart.setDate(today.getDate() + startDaysFromToday);

  for (let i = 0; i < numberOfBookings; i++) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + bookingLength - 1);
    bookings.push({ start: currentStart, end: currentEnd });

    // Set the start of the next booking
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentEnd.getDate() + 3); // 2-day gap + 1 to start the next day
  }

  for (let date = new Date(today); date < endDate; date.setDate(date.getDate() + 1)) {
    const isBookable = !bookings.some((booking) => date >= booking.start && date <= booking.end);
    const calendarDate: ISODate = date.toISOString().split('T')[0] as ISODate;
    daysArray.push({
      bookable: isBookable,
      calendarDate: calendarDate,
      minNights: 2,
    });
  }

  const months: Record<string, MerlinCalendarMonth> = {};
  daysArray.forEach((d) => {
    const [, month] = d.calendarDate.split('-');
    if (!months[month]) months[month] = { month: Number(month), year: 0, days: [] };
    months[month].days.push(d);
  });
  return Object.values(months);
};

export const airbnbGetResonse = `<!doctype html>
  <html lang="en" dir="ltr" data-is-hyperloop="true" class="scrollbar-gutter">

  <head>
    <meta charSet="utf-8" />
    <meta name="locale" content="en" />
    <meta name="google" content="notranslate" />
    <meta id="csrf-param-meta-tag" name="csrf-param" content="authenticity_token" />
    <meta id="csrf-token-meta-tag" name="csrf-token" content="" />
    <meta id="english-canonical-url" content="" />
    <meta name="twitter:widgets:csp" content="on" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="application-name" content="Airbnb" />
    <meta name="apple-mobile-web-app-title" content="Airbnb" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="msapplication-navbutton-color" content="#ffffff" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="msapplication-starturl" content="/?utm_source=homescreen" />
    <link rel="stylesheet"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/core-guest-loop/apps/core-guest-spa/client.5ddf563668.css"
      type="text/css" crossorigin="anonymous" media="all" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/hyperloop-browser/metroRequire.f041c10b23.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/hyperloop-browser/shims_post_modules.3a508a05ae.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/en/frontend/airmetro/browser/asyncRequire.b53b0d2f62.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/hyperloop-browser/coreV2.177bd66c58.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/f29e.66fc6bd74f.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/core-guest-loop/routeHandler.3fb3d8a56e.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/en/3af3.e3965ab778.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/31c5.91be35e898.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/5807.7d5720a7ec.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/80b1.382a5d0f53.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/core-guest-loop/apps/core-guest-spa/initializer.7ba68c6f89.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/guest-header/query/HeaderQuery.prepare.ed6fcb10c6.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/9024.36820ff613.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/af6e.0cb03852c2.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/niobe/minimalist/index.8735093809.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/en/5ab1.a542d18bf4.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/en/ab3c.75af55b393.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/8bdd.07c77f343a.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/215b.a9a22c7187.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/en/1a9c.195d4f33a8.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/ccf1.64d4608ad1.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/en/0cb5.f77b0414b8.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/ab12.92369a5132.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/28a6.9ad92f6155.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/en/frontend/gp-stays-pdp-route/routes/PdpPlatformRoute.314071b88c.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/common/frontend/gp-stays-pdp-route/routes/PdpPlatformRoute.prepare.1a158e52cf.js"
      as="script" crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/f4c9.fac2c7f552.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/1742.dec90c42cb.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/2111.2c40e6e78d.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/92d4.f248e80107.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/85ed.e726dda7ac.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/en/2953.6f915e37cf.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/676e.de0db7820a.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/22f4.4d35ad6da8.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/322b.cb5041703b.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload" href="https://a0.muscache.com/airbnb/static/packages/web/common/08da.ac19355ecf.js" as="script"
      crossorigin="anonymous" />
    <link rel="preload"
      href="https://a0.muscache.com/airbnb/static/packages/web/en/frontend/core-guest-loop/apps/core-guest-spa/client.088e438877.js"
      as="script" crossorigin="anonymous" />
    <script>
      (function() {
  // pg_pixel is no-op now.
  })()
    </script>
    <script>
      (function(){function a(c){if(window._errorReportingInitialized)return void window.removeEventListener("error",a);const{error:d}=c;if(!d)return;const e=c.message||d.message,f=/Requiring unknown module/.test(e)?1/100:1/10;if(Math.random()>f)return;const{locale:g,tracking_context:h}=window[Symbol.for("__ global cache key __")]?.["string | airbnb-bootstrap-data"]?.["_bootstrap-layout-init"]??{},i=g||navigator.language,j=location.pathname,k="undefined"==typeof window?{sampleRate:f+""}:{tags:{loggingSource:"browser",sampleRate:f+""}};fetch("https://notify.bugsnag.com/",{headers:{"Bugsnag-Payload-Version":"5"},body:JSON.stringify({apiKey:"e393bc25e52fe915ffb56c14ddf2ff1b",payloadVersion:b,notifier:{name:"Bugsnag JavaScript",version:"0.0.5-AirbnbUnhandledBufferedErrorCustomFetch",url:""},events:[{exceptions:[{errorClass:d.name,message:e,stacktrace:[{file:c.filename,lineNumber:c.lineno,columnNumber:c.colno}],type:"browserjs"}],request:{url:location.href},context:j,groupingHash:d.name.concat("-",e,"-",j),unhandled:!0,app:{releaseStage:h?.environment},device:{time:new Date,userAgent:navigator.userAgent},metaData:{infra:{app_name:h?.app,is_buffered_error:!0,loop_name:h?.controller,locale:i,service_worker_url:navigator.serviceWorker?.controller?.scriptURL},...k}}]}),method:"POST"})}const b="5";"undefined"!=typeof window&&window.addEventListener("error",a)})();
    </script>
    <div id="fb-root"></div>
    <div id="authModals"></div>
    <script id="data-deferred-state-0" data-deferred-state-0="true" type="application/json">
      {"niobeMinimalClientData":[[null,{"data":{"presentation":{"stayProductDetailPage":{"sections":{"sections":[{"section":{"__typename":"GeneralContentSection","button":null,"BasicButtonFragment":null,"icon":null,"mediaItem":{"__typename":"Image","id":"SW1hZ2U6d2hhdF9jb3VudHNfYXNfYV9wZXQ=","aspectRatio":null,"orientation":null,"onPressAction":null,"accessibilityLabel":"A guest with a service animal being greeted by a host","baseUrl":"https://a0.muscache.com/pictures/adafb11b-41e9-49d3-908e-049dfd6934b6.jpg","displayAspectRatio":null,"imageMetadata":null,"previewEncodedPng":"https://a0.muscache.com/pictures/adafb11b-41e9-49d3-908e-049dfd6934b6.jpg","overlay":null,"loggingEventData":null},"subtitle":null,"subtitleStyle":null,"title":"Service animals","titleStyle":null,"headingLevel":null,"html":{"__typename":"Html","htmlText":"Service animals aren’t pets, so there’s no need to add them here.<br><br>Traveling with an emotional support animal? Check out our <a href=\\"https://www.airbnb.com/help/article/1869/assistance-animals\\" target=\\"_blank\\">accessibility policy</a>.","readMoreButton":null,"textStyle":null,"recommendedNumberOfLines":null,"minimumNumberOfLinesForTruncation":null},"kickerBadge":null}},{"section":{"__typename":"PhotoTourModalSection","title":null,"mediaItems":[[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null],[null]],"gridImageLoggingEventData":{"__typename":"LoggingEventData","loggingId":"pdp.photoTour.gridImage","experiments":null,"eventData":null,"eventDataSchemaName":null,"section":"photoTour","component":"gridImage"},"carouselImageNavigationLoggingEventData":{"__typename":"LoggingEventData","loggingId":"pdp.photoTour.carouselImageNavigation","experiments":null,"eventData":null,"eventDataSchemaName":null,"section":"photoTour","component":"carouselImageNavigation"},"shareSave":{"__typename":"ShareSave","entityType":"STAY","shareButton":[null],"saveButton":[null],"unsaveButton":[null],"embedData":[null],"sharingConfig":[null]},"closeButton":{"__typename":"BasicListItem","title":"Close","anchor":null,"icon":null,"loggingEventData":[null],"action":null},"imageNavigationLoggingEventData":null,"recommendedNumberOfHighlights":null,"roomTourLayoutInfos":[[null]],"translationDisclaimer":{"__typename":"BasicListItem","title":null,"subtitle":"Translate to English","icon":"COMPACT_NO_TRANSLATION","loggingEventData":[null]},"showOriginalDisclaimer":{"__typename":"BasicListItem","title":"Automatically translated.","subtitle":"Show original","icon":"COMPACT_TRANSLATE","loggingEventData":[null]},"isAutoTranslatedOn":true}},{"section":{"__typename":"PoliciesSection","title":"Things to know","cancellationPolicyForDisplay":null,"additionalHouseRules":null,"additionalHouseRulesTitle":null,"cancellationPolicyTitle":"Cancellation policy","houseRulesTitle":"House rules","listingExpectationsTitle":null,"safetyAndPropertyTitle":"Safety & property","houseRules":[{"__typename":"BasicListItem","icon":null,"title":"Check-in: 3:00 PM - 10:00 PM"},{"__typename":"BasicListItem","icon":null,"title":"Checkout before 11:00 AM"},{"__typename":"BasicListItem","icon":null,"title":"6 guests maximum"}],"listingExpectations":null,"previewSafetyAndProperties":[{"__typename":"SafetyAndPropertyInfo","title":"Exterior security cameras on property","icon":null,"learnMoreButton":null}]}},{"section":{"__typename":"GeneralListContentSection","buttons":null,"caption":null,"ctaButton":null,"flip":null,"headingLevel":null,"items":[[null],[null]],"kickerString":null,"logoData":null,"mediaItems":null,"subtitle":null,"subtitleStyle":null,"title":"About","titleStyle":null}},{"section":{"__typename":"StayPdpReviewsSection","title":null,"subtitle":null,"ratings":null,"ratingDistribution":[],"ratingDistributionTitle":"Overall rating","heading":{"__typename":"BasicListItem","accessibilityLabel":"5.0 out of 5 stars from 16 reviews","icon":"COMPACT_STAR","title":"5.0 · 16 reviews","subtitle":null},"modalHeading":{"__typename":"BasicListItem","title":"5.0","subtitle":null},"overallCount":16,"overallRating":5,"seeAllReviewsButton":{"__typename":"BasicListItem","title":"Show all 16 reviews","accessibilityLabel":"Show all 16 reviews, Opens modal dialog","loggingEventData":[null]},"seeMoreReviewsLoggingEventData":{"__typename":"LoggingEventData","loggingId":"pdp.reviews.moreReviews","experiments":null,"eventData":null,"eventDataSchemaName":null,"section":"reviews","component":"moreReviews"},"reviewerProfilePhotoLoggingEventData":{"__typename":"LoggingEventData","loggingId":"pdp.reviews.reviewerPhoto","experiments":null,"eventData":null,"eventDataSchemaName":null,"section":"reviews","component":"reviewerPhoto"},"translateReviewsLoggingEventData":{"__typename":"LoggingEventData","loggingId":"pdp.reviews.translate","experiments":null,"eventData":null,"eventDataSchemaName":null,"section":"reviews","component":"translate"},"reviewImpressionLoggingEventData":{"__typename":"LoggingEventData","loggingId":"pdp.reviews.review","experiments":null,"eventData":null,"eventDataSchemaName":null,"section":"reviews","component":"review"},"titleAccessibilityLabel":null,"disclaimer":null,"isGuestFavorite":null,"brandDescription":null,"reviewsData":{"__typename":"PdpReviewsSectionReviewData","accessibilityLabel":"Rated 5.0 out of 5 from 16 reviews.","reviewRating":"5.0"},"reviewSortSelect":{"__typename":"ReviewSortSelect","accessibilityLabel":"Ratings sort order","loggingId":"pdp.reviews.sort_select","options":[null]},"style":null,"styles":null,"reviewTags":[],"qualityScorePercentile":null}},{"section":{"__typename":"LocationSection","title":"Where you’ll be","subtitle":"New Castle, New York, United States","lat":41.170173334784195,"lng":-73.70689222440356,"homeIcon":"COMPACT_HOUSE","mapMarkerType":"APPROX","address":null,"addressTitle":null,"locationDisclaimer":null,"fullscreenMapDisclaimer":"Exact location provided after booking.","previewLocationDetails":[[null]],"listingLocationVerificationDetails":{"__typename":"ListingLocationVerificationDetails","isVerified":false,"verifiedHelpHtml":null,"verifiedHelpLinkText":null,"verifiedHelpModalContent":null},"summaryLocationDetails":[],"seeAllLocationDetails":[],"seeAllDetailsButton":null,"hostGuidebookButton":null,"mapMarkerAccessibilityLabel":null,"mapMarkerRadiusInMeters":500,"nearbyPlaces":null,"categoricalNearbyPlacesSheet":null}},{"section":{"__typename":"SBUISentinelSection"}},{"section":{"__typename":"SeoLinksSection","title":"Explore other options in and around New Castle","nearbyCities":[[null],[null],[null],[null],[null],[null],[null],[null],[null]],"internalLinksTitle":"Other types of stays on Airbnb","internalLinks":[[null],[null],[null],[null],[null],[null],[null],[null]],"breadcrumbs":[[null],[null],[null],[null],[null]]}},{"section":{"__typename":"PdpOnlyOnBookItSection","bookingStartTime":"2024-08-06T13:00:00.000Z","countdownStartTime":null,"bookingCloseTime":"2024-08-15T06:59:00.000Z","appDownloadModal":{"__typename":"PdpOnlyOnAppDownloadModal","title":"Get the app","subtitle":"Use the Airbnb app to request to book Icons and get notified about new ones.","appDownloadCtaLoggingEventData":[null]},"mainCta":{"__typename":"PdpOnlyOnCta","ctaLoggingEventData":[null],"ctaText":"Notify me","ctaType":"NOTIFY","title":null,"subtitle":null},"countdownCta":{"__typename":"PdpOnlyOnCta","ctaLoggingEventData":[null],"ctaText":"Request","ctaType":"NOTIFY","title":null,"subtitle":null},"transitionCta":{"__typename":"PdpOnlyOnCta","ctaLoggingEventData":[null],"ctaText":"Request","ctaType":"NOTIFY","title":"<b>$39</b> per guest","subtitle":"14 dates available"},"specialOfferParams":null}},{"section":{"__typename":"NavSection","logo":null,"navItems":[[null],[null],[null]]}},{"section":null},{"section":{"__typename":"PdpHighlightsSection","highlights":[[null],[null],[null],[null]]}},{"section":{"__typename":"PdpDescriptionSection","title":null,"contactHostButton":null,"hostQuote":null,"htmlDescription":{"__typename":"ReadMoreHtml","recommendedNumberOfLines":6,"htmlText":"Calling all mutants! Or anyone who feels just a little bit different. Now’s your shot to find out how super special you are at Xavier’s Institute for Higher Learning. We’re totally ready to welcome mutant trainees like you to our newest class. Anyway, get ready for the coolest orientation ever!<br /><br /><b>What you’ll do</b><br />The X-Mansion is the best place for you and other mutants to learn about and control your awesome mutant gifts. Oh man, it’ll be packed with training, cool experiments, secret mission briefings, and a class photo at the end to remember your fellow mutants.<br /><br />Here’s the scoop on your day at the X-Mansion...<br /><br />• I’ll lead you through new student orientation (don’t worry we’ll get to the fun stuff fast).<br /><br />• Enter Beast’s totally gnarly lab! It’s like a science playground where you’ll be able to power-up with mutant energy elixirs. <br /><br />• Take a class in the Danger Room, where some of our combat professors will teach you how to improve your fighting skills—you never know when you’ll have to fend off The Hellfire Club!<br /><br />• Head to the War Room to try on Cerebro, and find out your mutant superpower. Maybe you’ll be an Omega level mutant like Storm! <br /><br />• Before you leave, we’ll debrief you on your new powers AND you can snag your official diploma and class photo.","readMoreButton":[null]},"ugcTranslationButton":null,"showMoreDescriptionButton":{"__typename":"BasicListItem","title":"Show more","action":[null],"loggingEventData":null},"hasExtraDescriptionDetails":true,"descriptionSummary":{"__typename":"Html","htmlText":"Calling all mutants! Or anyone who feels just a little bit different. Now’s your shot to find out how super special you are at Xavier’s Institute for Higher Learning. We’re totally ready to welcome mutant trainees like you to our newest class. Anyway, get ready for the coolest orientation ever!","recommendedNumberOfLines":99999,"minimumNumberOfLinesForTruncation":9}}},{"section":{"__typename":"MeetYourHostSection","titleText":"Meet your Host","cardData":{"__typename":"PassportCardData","name":"Jubilee","userId":"RGVtYW5kVXNlcjo1NzAyNzQzMTM=","titleText":"Host","profilePictureUrl":"https://a0.muscache.com/im/pictures/user/User-570274313/original/d7c84454-58ca-47a3-8436-75ecca56cb0e.jpeg","profileLoggingId":"pdp.meetYourHost.idCard","isSuperhost":false,"isVerified":true,"stats":[null],"timeAsHost":[null],"ratingCount":45,"ratingAverage":5},"about":"Hey, I’m Jubilee! If I’m not at the mall, you can find me hanging with my fellow X-Men. We’re talking Cyclops, Storm, and Wolverine! I learned how to light up the sky at Xavier’s Institute for Higher Learning. Basically, I have the power to shoot fireworks from my hands. Rad, huh? Can’t wait to have you over to the house so you can see what we’re all about.","aboutReadMoreLoggingId":"pdp.meetYourHost.aboutReadMore","hostHighlights":[[null],[null],[null],[null],[null]],"hostHighlightsShowMoreLoggingId":"pdp.meetYourHost.hostHighlightsShowMore","contactHostCopy":null,"contactHostLoggingId":null,"hostRespondTimeCopy":null,"cohostsTitleText":null,"cohosts":[],"placementGroup":"ALONG_SIDEBAR","businessDetailsItem":null,"policyNumber":null,"disclaimer":null,"hostDetailsTitleText":null,"hostDetails":null,"superhostTitleText":null,"superhostText":null,"translationTip":null,"hostMetrics":null}},{"section":{"__typename":"PdpTitleSection","title":"Train at the X-Mansion","icon":null,"logo":null,"overviewItems":null,"logoAccessibilityLabel":null,"shareSave":{"__typename":"ShareSave","entityId":"1208022985954091133","entityType":"STAY","shareButton":[null],"saveButton":[null],"unsaveButton":[null],"sharingConfig":[null],"embedData":[null]},"actionableIcon":null}}]}}}}}]]}
    </script>
  </body>

  </html>`;
